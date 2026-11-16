"use client";

import { useEffect, useRef, useState } from "react";
import { haversineM } from "./geo";

export type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  /** Metres per second, smoothed. 0 when standing still. */
  speed: number;
  /** Degrees from north while moving, else null. */
  heading: number | null;
  at: number;
};

export type LivePosition =
  | { status: "waiting" | "denied" | "unavailable" }
  | { status: "on"; fix: Fix };

/** Below this the device is treated as standing still, so GPS drift reads 0 km/h. */
const MOVING_MS = 1;

/**
 * Watches the device position with high accuracy. Speed comes from the
 * device when it reports one, otherwise from the distance between fixes.
 * `attempt` restarts the watch, for a "Try again" button. `onFix` and
 * `onError` run for each answer, outside render, with the latest closure.
 */
export function useLivePosition(
  attempt = 0,
  handlers?: { onFix?: (fix: Fix) => void; onError?: (status: "denied" | "unavailable") => void },
): LivePosition {
  const [pos, setPos] = useState<LivePosition>({ status: "waiting" });
  const last = useRef<Fix | null>(null);
  const on = useRef(handlers);
  useEffect(() => {
    on.current = handlers;
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      void Promise.resolve().then(() => {
        setPos({ status: "unavailable" });
        on.current?.onError?.("unavailable");
      });
      return;
    }
    void Promise.resolve().then(() => setPos((p) => (p.status === "on" ? p : { status: "waiting" })));
    const id = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const prev = last.current;
        let speed = coords.speed ?? NaN;
        if (!Number.isFinite(speed) || speed < 0) {
          const dt = prev ? (timestamp - prev.at) / 1000 : 0;
          const moved = prev ? haversineM(prev.lat, prev.lng, coords.latitude, coords.longitude) : 0;
          // Moves smaller than the fix's own error are noise, not driving.
          speed = dt > 0.5 && moved > coords.accuracy * 0.5 ? moved / dt : 0;
        }
        if (prev) speed = prev.speed * 0.4 + speed * 0.6;
        if (speed < MOVING_MS) speed = 0;
        const moving = speed >= MOVING_MS;
        const heading =
          moving && coords.heading !== null && Number.isFinite(coords.heading) ? coords.heading : moving ? (prev?.heading ?? null) : null;
        const fix: Fix = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, speed, heading, at: timestamp };
        last.current = fix;
        setPos({ status: "on", fix });
        on.current?.onFix?.(fix);
      },
      (err) => {
        // A tunnel or a slow fix after a good one: keep the last fix and keep watching.
        if (err.code !== err.PERMISSION_DENIED && last.current) return;
        const status = err.code === err.PERMISSION_DENIED ? "denied" : "unavailable";
        setPos({ status });
        on.current?.onError?.(status);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [attempt]);

  return pos;
}
