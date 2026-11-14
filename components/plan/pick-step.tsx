"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Loader2, RotateCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Category } from "@/convex/lib/categories";
import type { RouteStop } from "@/convex/lib/routeTrip";
import { CategoryChip, CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { useMapActions, useMapPointClick, useMapScene, type MapPoint, type Scene } from "@/components/map/map-store";
import { PlaceImage } from "@/components/place/place-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance, formatMinutes } from "@/lib/format";
import { boundsOfCoords, type LngLat } from "@/lib/geo";
import { endsKey, setRoadTrip, useRoadTrip, type End } from "@/lib/road-trip";
import { cn } from "@/lib/utils";

export type Along = {
  route: { coordinates: LngLat[]; distanceM: number; durationS: number };
  stops: RouteStop[];
  partial: boolean;
};

type State =
  | { status: "loading"; line: Along["route"] | null }
  | { status: "ready"; data: Along }
  | { status: "error"; message: string; line: Along["route"] | null };

// Results for this visit, so going back and forth between steps is instant.
const memo = new Map<string, Along>();

/** The road and the places along it. Draws the line first, the places follow. */
function useAlong(from: End, to: End) {
  const along = useAction(api.trips.alongRoute);
  const getRoute = useAction(api.routes.get);
  const key = endsKey(from, to);
  const [state, setState] = useState<{ key: string; state: State } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const hit = memo.get(key);
    if (hit) {
      void Promise.resolve().then(() => setState({ key, state: { status: "ready", data: hit } }));
      return;
    }
    let live = true;
    let line: Along["route"] | null = null;
    const ends = { from: { name: from.name, lat: from.lat, lng: from.lng }, to: { name: to.name, lat: to.lat, lng: to.lng } };
    void Promise.resolve().then(() => live && setState({ key, state: { status: "loading", line: null } }));
    getRoute({ points: [ends.from, ends.to], profile: "driving" })
      .then((r) => {
        if (!live || !r) return;
        line = r as Along["route"];
        setState((s) => (s?.state.status === "loading" ? { key, state: { status: "loading", line } } : s));
      })
      .catch(() => {});
    along(ends)
      .then((res) => {
        if (!live) return;
        if (!res) {
          setState({ key, state: { status: "error", message: "No road was found between these places. Try towns closer to a highway.", line } });
          return;
        }
        memo.set(key, res as Along);
        setState({ key, state: { status: "ready", data: res as Along } });
      })
      .catch(() => {
        if (live) setState({ key, state: { status: "error", message: "The map service didn't answer. Try again in a moment.", line } });
      });
    return () => {
      live = false;
    };
    // from and to are captured through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, along, getRoute]);

  const current: State = state?.key === key ? state.state : { status: "loading", line: null };
  return { state: current, retry: () => setAttempt((n) => n + 1) };
}

/** Filter chips: each is a set of category keys, labelled and coloured by its first. */
const GROUPS: Category[][] = [
  ["attraction", "heritage", "museum", "religious"],
  ["food", "cafe"],
  ["stay"],
  ["fuel"],
  ["park"],
  ["shopping"],
];

/** Stays near where each night falls, as a hint. Night n sits n/days of the way along. */
function nightHints(stops: RouteStop[], totalKm: number, days: number): Map<string, number> {
  const out = new Map<string, number>();
  if (days < 2) return out;
  const stays = stops.filter((s) => s.category === "stay");
  const share = totalKm / days;
  for (let n = 1; n < days; n++) {
    const target = share * n;
    stays
      .filter((s) => !out.has(s.key) && Math.abs(s.kmAlong - target) < share * 0.35)
      .sort((a, b) => Math.abs(a.kmAlong - target) - Math.abs(b.kmAlong - target))
      .slice(0, 3)
      .forEach((s) => out.set(s.key, n));
  }
  return out;
}

const toPoint = (s: RouteStop): MapPoint => ({ id: s.key, name: s.name, category: s.category, lat: s.lat, lng: s.lng, score: s.score, image: s.image });
const PAGE = 60;

/** Step 2: choose stops along the road. */
export function PickStep({
  from,
  to,
  onBack,
  onMake,
}: {
  from: End;
  to: End;
  onBack: () => void;
  onMake: (data: Along, picked: RouteStop[]) => void;
}) {
  const trip = useRoadTrip();
  const { state, retry } = useAlong(from, to);
  const [group, setGroup] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const { setHighlight } = useMapActions();

  const data = state.status === "ready" ? state.data : null;
  const line = data?.route ?? (state.status !== "ready" ? state.line : null);
  const totalKm = line ? line.distanceM / 1000 : 0;
  const picked = useMemo(() => new Set(trip.picked), [trip.picked]);
  const stops = useMemo(() => data?.stops ?? [], [data]);
  const hints = useMemo(() => nightHints(stops, totalKm, trip.days), [stops, totalKm, trip.days]);

  const counts = useMemo(() => GROUPS.map((g) => stops.filter((s) => (g as string[]).includes(s.category)).length), [stops]);
  const shown = useMemo(
    () => (group === null ? stops : stops.filter((s) => (GROUPS[group] as string[]).includes(s.category))),
    [stops, group],
  );
  const pickedStops = useMemo(() => stops.filter((s) => picked.has(s.key)), [stops, picked]);

  const toggle = useCallback((key: string) => {
    setRoadTrip((t) => ({ picked: t.picked.includes(key) ? t.picked.filter((k) => k !== key) : [...t.picked, key] }));
  }, []);
  const onPin = useCallback((p: MapPoint) => toggle(p.id), [toggle]);
  useMapPointClick(onPin);

  const routeKey = endsKey(from, to);
  const scene = useMemo<Scene>(
    () => ({
      points: shown.filter((s) => !picked.has(s.key)).map(toPoint),
      stops: pickedStops.map(toPoint),
      route: line?.coordinates ?? null,
      camera: line
        ? { key: `trip:${routeKey}`, bounds: boundsOfCoords(line.coordinates) }
        : { key: `trip-ends:${routeKey}`, bounds: boundsOfCoords([[from.lng, from.lat], [to.lng, to.lat]]) },
    }),
    [shown, picked, pickedStops, line, routeKey, from.lat, from.lng, to.lat, to.lng],
  );
  useMapScene(scene);

  return (
    <div className="px-4 pt-2 md:pt-5">
      <button
        type="button"
        onClick={onBack}
        className="press -ml-1.5 inline-flex h-8 items-center gap-0.5 rounded-full pr-2.5 pl-1 text-[13px] font-medium text-link hover:bg-accent"
      >
        <ChevronLeft className="size-4" aria-hidden /> Change trip
      </button>
      <h1 className="large-title mt-0.5">Pick your stops</h1>
      <p className="mt-1 truncate text-[15px] font-medium">
        {from.name} <span className="font-normal text-muted-foreground">to</span> {to.name}
      </p>
      <p className="text-[13px] text-muted-foreground tabular-nums">
        {line ? `${formatDistance(line.distanceM)} · ${formatMinutes(line.durationS / 60)} drive · ` : ""}
        {trip.days} {trip.days === 1 ? "day" : "days"}
      </p>

      {state.status === "loading" && (
        <div aria-live="polite">
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-hairline">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[var(--route)]" aria-hidden />
            <div>
              <p className="text-[15px] font-medium tabular-nums">
                {line ? `Finding places along ${formatDistance(line.distanceM)} of road` : "Finding the road"}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Sights, food, stays and fuel. A new road takes about half a minute the first time, then it&apos;s instant.
              </p>
            </div>
          </div>
          <div className="mt-3 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-14 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4 rounded-2xl bg-surface p-4 ring-1 ring-hairline">
          <p className="text-[15px] font-medium">Couldn&apos;t find places on this road</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{state.message}</p>
          <div className="mt-3 flex gap-2">
            <Button className="h-9 rounded-full px-4" onClick={retry}>
              <RotateCw aria-hidden /> Try again
            </Button>
            <Button variant="outline" className="h-9 rounded-full px-4" onClick={onBack}>
              Change trip
            </Button>
          </div>
        </div>
      )}

      {data && (
        <>
          {data.partial && (
            <p className="mt-3 rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] text-muted-foreground dark:bg-white/5">
              The map service was busy, so a few places may be missing.
            </p>
          )}
          <div className="fade-x -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Show">
            <CategoryChip active={group === null} onClick={() => { setGroup(null); setLimit(PAGE); }} label={`All ${stops.length}`} />
            {GROUPS.map((g, i) =>
              counts[i] === 0 ? null : (
                <CategoryChip
                  key={g.join()}
                  category={g[0]}
                  active={group === i}
                  onClick={() => {
                    setGroup(group === i ? null : i);
                    setLimit(PAGE);
                  }}
                  label={`${categoryLabel(g[0])} ${counts[i]}`}
                />
              ),
            )}
          </div>

          {shown.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-6 text-center">
              <p className="text-[15px] font-medium">Nothing like that on this road</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Try another filter, or make the plan with what you have.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
              {shown.slice(0, limit).map((s) => (
                <StopOption
                  key={s.key}
                  stop={s}
                  on={picked.has(s.key)}
                  night={hints.get(s.key)}
                  onToggle={() => toggle(s.key)}
                  onHover={setHighlight}
                />
              ))}
            </ul>
          )}
          {shown.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="press mt-2 h-10 w-full rounded-full text-[14px] font-medium text-link hover:bg-accent"
            >
              Show more ({shown.length - limit})
            </button>
          )}
        </>
      )}

      <div className="sticky bottom-0 -mx-4 mt-4 bg-gradient-to-t from-[color-mix(in_oklch,var(--surface)_95%,transparent)] from-60% px-4 pt-3 pb-4">
        <Button
          className="h-11 w-full rounded-full text-[15px]"
          disabled={!data}
          onClick={() => data && onMake(data, pickedStops)}
        >
          <span className="tabular-nums">
            {pickedStops.length === 0 ? "No stops yet" : `${pickedStops.length} ${pickedStops.length === 1 ? "stop" : "stops"} picked`}
          </span>
          <span aria-hidden className="opacity-60">·</span>
          Make my plan
        </Button>
      </div>
    </div>
  );
}

function StopOption({
  stop,
  on,
  night,
  onToggle,
  onHover,
}: {
  stop: RouteStop;
  on: boolean;
  night?: number;
  onToggle: () => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        onMouseEnter={() => onHover(stop.key)}
        onMouseLeave={() => onHover(null)}
        className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150", on ? "bg-[var(--route)]/[0.07]" : "hover:bg-accent")}
      >
        {stop.image ? (
          <PlaceImage src={stop.image} alt="" category={stop.category} ratio="1/1" width={330} sizes="56px" className="size-14 shrink-0 rounded-xl" />
        ) : (
          <CategoryTile category={stop.category} className="size-14 rounded-xl" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-5 font-medium">{stop.name}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{categoryLabel(stop.category)}</span>
          <span className="block truncate text-[12px] text-muted-foreground tabular-nums">
            km {Math.round(stop.kmAlong)} · {stop.offKm < 0.1 ? "on the road" : `${stop.offKm.toFixed(1)} km off road`}
          </span>
          {night !== undefined && (
            <span data-cat="stay" className="mt-1 inline-flex h-5 items-center rounded-full bg-cat-soft px-2 text-[11px] font-medium text-cat-ink">
              Good for night {night}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
            on ? "bg-[var(--route)] text-white" : "ring-[1.5px] ring-border ring-inset",
          )}
        >
          {on && <Check className="size-4" strokeWidth={2.5} />}
        </span>
      </button>
    </li>
  );
}
