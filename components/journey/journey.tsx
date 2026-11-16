"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, LocateOff, MapPin, MapPinned, RouteOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { haversineM } from "@/lib/geo";
import { dayNavigationUrls } from "@/lib/google-maps";
import {
  ARRIVE_M,
  bearingDeg,
  buildTrack,
  OFF_ROUTE_M,
  progressAt,
  secondsBetween,
  snap,
  splitAt,
  type Snap,
  type Track,
} from "@/lib/navigation";
import { formatDistance } from "@/lib/format";
import { useDraft, type DraftStop } from "@/lib/plan-draft";
import { useLivePosition, type Fix } from "@/lib/use-live-position";
import { JourneyMap, type Puck } from "./journey-map";
import { DonePanel, FollowButton, JourneyPanel, SpeedBadge, type NextStop, type Stats } from "./journey-panel";
import { BannerIcon, BannerShell, BannerText, ManeuverBanner } from "./maneuver";

/** Farther than this from the first stop, the route starts at the stops, not at you. */
const FAR_M = 400_000;
/** OSRM takes ten points: you and nine stops. */
const MAX_STOPS = 9;
/** Moving this far from a stop you arrived at moves on to the next one. */
const LEAVE_M = 150;
/** Without a fix after this long, show the day's road anyway. */
const NO_FIX_MS = 6000;

type RouteState = {
  status: "idle" | "loading" | "ready" | "error";
  track: Track | null;
  /** user: starts at the visitor. stops: starts at the first stop left (no fix, or far away). */
  from: "user" | "stops" | null;
  /** Index of the first stop this route covers. */
  base: number;
  farM?: number;
};

const noop = () => () => {};

/** /journey?day=n: drive one day of the current plan. */
export function Journey() {
  const params = useSearchParams();
  const draft = useDraft();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);

  if (!hydrated) {
    return (
      <Centre>
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label="Loading your trip" />
      </Centre>
    );
  }
  const n = Number(params.get("day"));
  const index = Number.isInteger(n) && n >= 1 && n <= draft.days.length ? n - 1 : draft.activeDay;
  const day = draft.days[index];
  if (!day || day.stops.length === 0) {
    return (
      <Centre>
        <MapPinned className="mx-auto size-7 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">Nothing to drive yet</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Day {index + 1} has no stops. Add a few in your plan, then start the journey.
        </p>
        <Link
          href="/plan"
          className="press mt-5 inline-flex h-11 items-center rounded-full bg-[var(--route)] px-6 text-[15px] font-medium text-white"
        >
          Open your plan
        </Link>
      </Centre>
    );
  }
  return <Drive key={`${day.key}:${day.stops.map((s) => s.key).join()}`} dayNumber={index + 1} stops={day.stops} />;
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );
}

/** Keep the screen on while driving, where the browser allows it. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Low battery or not allowed: the screen may dim, nothing else changes.
      }
    };
    void get();
    const onVisible = () => void get();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function Drive({ dayNumber, stops }: { dayNumber: number; stops: DraftStop[] }) {
  const router = useRouter();
  const navigate = useAction(api.routes.navigate);
  const [attempt, setAttempt] = useState(0);
  const [route, setRoute] = useState<RouteState>({ status: "idle", track: null, from: null, base: 0 });
  const [reached, setReached] = useState(0);
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [open, setOpen] = useState(false);
  /** Where the last fix sat on the road. The next snap starts from it, and render reads it. */
  const [snapped, setSnapped] = useState<{ track: Track; s: Snap } | null>(null);
  const seq = useRef(0);
  const offCount = useRef(0);
  const lastLoad = useRef(0);
  const latest = useRef<Fix | null>(null);
  const now = useNow(15_000);
  useWakeLock();

  async function load(origin: Fix | null, base: number) {
    const id = ++seq.current;
    lastLoad.current = Date.now();
    offCount.current = 0;
    const left = stops.slice(base);
    if (left.length === 0) return;
    const farM = origin ? haversineM(origin.lat, origin.lng, left[0].lat, left[0].lng) : 0;
    const fromUser = !!origin && farM < FAR_M;
    const far = origin && !fromUser ? farM : undefined;
    const points = (fromUser ? [origin, ...left.slice(0, MAX_STOPS)] : left.slice(0, MAX_STOPS + 1)).map((p) => ({ lat: p.lat, lng: p.lng }));
    const from = fromUser ? "user" : "stops";
    if (points.length < 2) {
      setRoute({ status: "ready", track: null, from, base, farM: far });
      return;
    }
    setRoute((r) => ({ ...r, status: "loading" }));
    try {
      const res = await navigate({ points });
      if (id !== seq.current) return;
      setRoute(
        res
          ? { status: "ready", track: buildTrack(res), from, base, farM: far }
          : (r) => ({ ...r, status: "error" }),
      );
    } catch {
      if (id === seq.current) setRoute((r) => ({ ...r, status: "error" }));
    }
  }

  function advance() {
    setArrivedAt(null);
    setReached((r) => Math.min(stops.length - 1, r + 1));
  }

  function skip() {
    const next = Math.min(stops.length - 1, reached + 1);
    setArrivedAt(null);
    setReached(next);
    void load(latest.current, next);
  }

  const pos = useLivePosition(attempt, {
    onFix: (fix) => {
      const prev = latest.current;
      latest.current = fix;
      if (route.status === "loading") return;
      // First fix, or the first fix after showing the day without one.
      const upgrade = route.from === "stops" && route.farM === undefined && Date.now() - lastLoad.current > 15_000;
      if (route.status === "idle" || upgrade) {
        void load(fix, reached);
        return;
      }
      const t = route.track;
      if (!t || route.from !== "user") return;
      const moved = prev ? haversineM(prev.lat, prev.lng, fix.lat, fix.lng) : 0;
      const heading = fix.heading ?? (prev && moved > 5 ? bearingDeg([prev.lng, prev.lat], [fix.lng, fix.lat]) : null);
      const hint = snapped?.track === t && snapped.s.offM < OFF_ROUTE_M ? snapped.s.index : undefined;
      const s = snap(t, [fix.lng, fix.lat], hint, heading);
      setSnapped({ track: t, s });

      offCount.current = s.offM > OFF_ROUTE_M && fix.accuracy < 75 ? offCount.current + 1 : 0;
      if (offCount.current >= 3 && Date.now() - lastLoad.current > 15_000) {
        void load(fix, reached);
        return;
      }

      const target = stops[reached];
      const d = haversineM(fix.lat, fix.lng, target.lat, target.lng);
      const leg = reached - route.base;
      const end = t.legEnds[leg];
      const onRoad = s.offM < OFF_ROUTE_M;
      // The road often ends short of the pin (a monument behind a gate), so
      // reaching the end of the leg counts as arriving too.
      const atEnd = end !== undefined && onRoad && Math.abs(s.along - end) < 40;
      if (d < ARRIVE_M || atEnd) {
        if (arrivedAt !== reached) setArrivedAt(reached);
        return;
      }
      const last = reached === stops.length - 1;
      // Driving on past the stop, whether we stopped there or the fixes skipped it.
      if (end !== undefined && onRoad && s.along > end + LEAVE_M && !last) return advance();
      if (arrivedAt === reached && d > LEAVE_M && end === undefined && !last) return advance();
      // Past the stops this route covers: route the rest.
      if (leg >= t.legs.length) void load(fix, reached);
    },
    onError: () => {
      if (seq.current === 0) void load(null, 0);
    },
  });

  // No fix yet after a few seconds: draw the day's road from its first stop.
  useEffect(() => {
    if (pos.status !== "waiting") return;
    const t = setTimeout(() => {
      if (seq.current === 0) void load(null, 0);
    }, NO_FIX_MS);
    return () => clearTimeout(t);
    // load reads the latest stops; it only needs to run once per wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.status, attempt]);

  const fix = pos.status === "on" ? pos.fix : null;
  const track = route.track;
  const live = !!(fix && track && route.from === "user");
  const legOffset = route.from === "user" ? 0 : 1;

  const view = useMemo(() => {
    const s = live && snapped?.track === track ? snapped.s : null;
    const onRoad = !!s && s.offM < 35;
    const puck: Puck | null = fix
      ? {
          point: onRoad ? s!.point : [fix.lng, fix.lat],
          bearing: onRoad ? s!.bearing : (fix.heading ?? s?.bearing ?? 0),
          speed: fix.speed,
          accuracy: fix.accuracy,
        }
      : null;
    const split = s && track && s.offM < 120 ? splitAt(track, s) : null;
    return { s, puck, progress: s && track ? progressAt(track, s.along) : null, split };
  }, [live, fix, track, snapped]);
  const { s, puck, progress, split } = view;

  const done = arrivedAt !== null && arrivedAt === stops.length - 1;
  const stopForLeg = (leg: number) => stops[route.base + leg + legOffset];

  const nextStop: NextStop | null = done
    ? null
    : (() => {
        const stop = stops[reached];
        const leg = reached - route.base - legOffset;
        if (s && track && leg >= 0 && track.legEnds[leg] !== undefined) {
          return { index: reached, stop, distanceM: Math.max(0, track.legEnds[leg] - s.along), seconds: secondsBetween(track, s.along, track.legEnds[leg]) };
        }
        const d = fix ? haversineM(fix.lat, fix.lng, stop.lat, stop.lng) : null;
        return { index: reached, stop, distanceM: d, seconds: null };
      })();

  const stats: Stats | null =
    live && progress
      ? { arrival: now + progress.remainingS * 1000, remainingS: progress.remainingS, remainingM: progress.remainingM, live: true }
      : track
        ? { arrival: null, remainingS: track.durationS, remainingM: track.total, live: false }
        : null;

  const googleUrl = dayNavigationUrls(fix, stops.slice(reached))[0] ?? null;
  const routeKey = track ? `${route.base}:${route.from}:${track.total.toFixed(0)}` : "none";

  return (
    <div className="fixed inset-0 overflow-hidden bg-muted">
      <JourneyMap
        done={split?.done ?? null}
        ahead={split?.ahead ?? track?.coords ?? null}
        stops={stops}
        reached={reached}
        puck={puck}
        follow={follow && !!puck}
        routeKey={routeKey}
        onUserMove={() => setFollow(false)}
      />

      <div className="absolute inset-x-2 top-[max(env(safe-area-inset-top),8px)] z-20 md:inset-x-auto md:top-3 md:left-3 md:w-[400px]">
        <Banner
          done={done}
          arrivedStop={arrivedAt !== null ? stops[arrivedAt] : null}
          nextAfterArrival={arrivedAt !== null ? stops[arrivedAt + 1] : undefined}
          onContinue={advance}
          pos={pos.status}
          route={route}
          progress={progress}
          stopName={progress?.next?.type === "arrive" ? stopForLeg(progress.next.leg)?.name : undefined}
          firstStop={stops[reached]}
          onRetryLocation={() => setAttempt((a) => a + 1)}
          onRetryRoute={() => void load(latest.current, reached)}
        />
      </div>

      <div className="absolute inset-x-2 bottom-[max(env(safe-area-inset-bottom),8px)] z-20 md:inset-x-auto md:bottom-3 md:left-3 md:w-[400px]">
        <div className="mb-2 flex items-end justify-between gap-2">
          {fix ? <SpeedBadge kmh={Math.round(fix.speed * 3.6)} /> : <span />}
          {puck && (
            <FollowButton follow={follow && !!puck} onFollow={() => setFollow(true)} onOverview={() => setFollow(false)} />
          )}
        </div>
        {done ? (
          <DonePanel dayNumber={dayNumber} count={stops.length} />
        ) : (
          <JourneyPanel
            dayNumber={dayNumber}
            stats={stats}
            next={nextStop}
            stops={stops}
            reached={reached}
            open={open}
            onToggle={() => setOpen((o) => !o)}
            onEnd={() => router.push("/plan")}
            onSkip={skip}
            googleUrl={googleUrl}
          />
        )}
      </div>
    </div>
  );
}

function Banner({
  done,
  arrivedStop,
  nextAfterArrival,
  onContinue,
  pos,
  route,
  progress,
  stopName,
  firstStop,
  onRetryLocation,
  onRetryRoute,
}: {
  done: boolean;
  arrivedStop: DraftStop | null;
  nextAfterArrival?: DraftStop;
  onContinue: () => void;
  pos: "waiting" | "denied" | "unavailable" | "on";
  route: RouteState;
  progress: ReturnType<typeof progressAt> | null;
  stopName?: string;
  firstStop: DraftStop;
  onRetryLocation: () => void;
  onRetryRoute: () => void;
}) {
  const retry = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="press h-9 shrink-0 rounded-full bg-primary-foreground px-3.5 text-[13px] font-semibold text-primary"
    >
      {label}
    </button>
  );

  if (arrivedStop) {
    return (
      <BannerShell>
        <BannerIcon tone="good">
          <MapPin className="size-6" strokeWidth={2} aria-hidden />
        </BannerIcon>
        <BannerText
          title={done ? `You've arrived at ${arrivedStop.name}` : `You're at ${arrivedStop.name}`}
          body={done ? "That was the last stop of the day." : nextAfterArrival ? `Next: ${nextAfterArrival.name}` : undefined}
          action={!done && nextAfterArrival ? retry("Continue", onContinue) : undefined}
        />
      </BannerShell>
    );
  }
  if (pos === "denied" || pos === "unavailable") {
    return (
      <BannerShell>
        <BannerIcon tone="warn">
          <LocateOff className="size-6" strokeWidth={2} aria-hidden />
        </BannerIcon>
        <BannerText
          title={pos === "denied" ? "Location is off" : "Can't find your location"}
          body={
            pos === "denied"
              ? "Allow location for this site in your browser settings to follow the drive. The day's road is on the map."
              : "Check that location is on, then try again. The day's road is on the map."
          }
          action={retry("Try again", onRetryLocation)}
        />
      </BannerShell>
    );
  }
  if (route.status === "error" && !route.track) {
    return (
      <BannerShell>
        <BannerIcon tone="warn">
          <RouteOff className="size-6" strokeWidth={2} aria-hidden />
        </BannerIcon>
        <BannerText title="Couldn't get directions" body="The routing service didn't answer." action={retry("Try again", onRetryRoute)} />
      </BannerShell>
    );
  }
  if (route.farM !== undefined) {
    return (
      <BannerShell>
        <BannerIcon>
          <MapPin className="size-6" strokeWidth={2} aria-hidden />
        </BannerIcon>
        <BannerText
          title={`You're ${formatDistance(route.farM)} from ${firstStop.name}`}
          body="This is the day's road. Directions start once you're on your way there."
        />
      </BannerShell>
    );
  }
  if (progress?.next) {
    return (
      <ManeuverBanner
        step={progress.next}
        toM={progress.toNextM}
        then={progress.then}
        stopName={stopName}
        rerouting={route.status === "loading"}
      />
    );
  }
  const finding = pos === "waiting" ? "Finding your location" : "Finding the road";
  return (
    <BannerShell>
      <BannerIcon>
        <Loader2 className="size-6 animate-spin" strokeWidth={2} aria-hidden />
      </BannerIcon>
      <BannerText title={finding} body={pos === "waiting" ? "Keep this screen open. The drive starts from where you are." : `Heading for ${firstStop.name}`} />
    </BannerShell>
  );
}
