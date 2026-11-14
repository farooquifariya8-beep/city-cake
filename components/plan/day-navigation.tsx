"use client";

import { useEffect, useState } from "react";
import { LocateFixed, Navigation, Square } from "lucide-react";
import { formatDistance, formatMinutes } from "@/lib/format";
import { haversineM } from "@/lib/geo";
import { dayNavigationUrls } from "@/lib/google-maps";
import type { DraftStop } from "@/lib/plan-draft";
import type { MyLocation } from "@/lib/use-my-location";
import { cn } from "@/lib/utils";

export type LivePosition =
  | { status: "off" | "waiting" | "denied" | "unavailable" }
  | { status: "on"; lat: number; lng: number; accuracy: number };

const REACHED_M = 150;
const AVG_KMH = 35;

/** Watches the device position while `on`. Clears the watch when turned off. */
export function useLivePosition(on: boolean): LivePosition {
  const [pos, setPos] = useState<LivePosition>({ status: "off" });
  useEffect(() => {
    if (!on) {
      void Promise.resolve().then(() => setPos({ status: "off" }));
      return;
    }
    if (!navigator.geolocation) {
      void Promise.resolve().then(() => setPos({ status: "unavailable" }));
      return;
    }
    void Promise.resolve().then(() => setPos({ status: "waiting" }));
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => setPos({ status: "on", lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      (err) => setPos({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on]);
  return pos;
}

/** The stop to head for: the one after the nearest if you are at it, else the nearest. */
function nextStop(stops: DraftStop[], at: { lat: number; lng: number }) {
  const d = stops.map((s) => haversineM(at.lat, at.lng, s.lat, s.lng));
  const k = d.indexOf(Math.min(...d));
  const i = d[k] <= REACHED_M ? k + 1 : k;
  return i < stops.length ? { stop: stops[i], index: i, distanceM: d[i] } : null;
}

/** "Start day N" in Google Maps, and the in-app live position for the day. */
export function DayNavigation({
  dayNumber,
  stops,
  loc,
  live,
  onLive,
  position,
}: {
  dayNumber: number;
  stops: DraftStop[];
  loc: MyLocation;
  live: boolean;
  onLive: (on: boolean) => void;
  position: LivePosition;
}) {
  if (stops.length === 0) return null;
  const origin = position.status === "on" ? position : loc.status === "found" ? loc : null;
  const urls = dayNavigationUrls(origin, stops);
  const next = position.status === "on" ? nextStop(stops, position) : null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((href, i) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            data-testid="start-day"
            className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--route)] px-4 text-[14px] font-medium whitespace-nowrap text-white hover:brightness-110"
          >
            <Navigation className="size-4" strokeWidth={2} aria-hidden />
            {urls.length > 1 ? `Start day ${dayNumber}, part ${i + 1}` : `Start day ${dayNumber}`}
          </a>
        ))}
        <button
          type="button"
          onClick={() => onLive(!live)}
          aria-pressed={live}
          className={cn(
            "press inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-medium",
            live ? "bg-foreground text-background" : "bg-black/[0.055] hover:bg-black/10 dark:bg-white/10",
          )}
        >
          {live ? <Square className="size-3.5" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
          {live ? "Stop" : "Live"}
        </button>
      </div>
      {urls.length > 1 && (
        <p className="text-[12px] text-muted-foreground">Google Maps takes up to 10 stops at a time, so this day opens in parts.</p>
      )}
      {live && (
        <div className="rounded-2xl bg-surface px-3.5 py-2.5 ring-1 ring-hairline" role="status">
          {position.status === "waiting" || position.status === "off" ? (
            <p className="text-[14px] text-muted-foreground">Finding your location</p>
          ) : position.status === "denied" ? (
            <p className="text-[14px] text-destructive">
              Location is blocked for this site. Allow it in your browser settings to follow the day live.
            </p>
          ) : position.status === "unavailable" ? (
            <p className="text-[14px] text-destructive">Couldn&apos;t get your location. Check that location is on and try again.</p>
          ) : next ? (
            <>
              <p className="text-[12px] text-muted-foreground">Next stop</p>
              <p className="truncate text-[15px] font-medium">
                <span className="mr-1 text-[var(--route)] tabular-nums">{next.index + 1}</span>
                {next.stop.name}
              </p>
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {formatDistance(next.distanceM)} away · about {formatMinutes(Math.max(1, Math.round((next.distanceM / 1000 / AVG_KMH) * 60)))}
              </p>
            </>
          ) : (
            <p className="text-[14px]">You have reached the last stop of day {dayNumber}.</p>
          )}
        </div>
      )}
    </div>
  );
}
