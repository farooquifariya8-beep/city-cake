"use client";

import { useSyncExternalStore } from "react";
import type { End } from "@/convex/lib/routeTrip";
import { HOME_CITY } from "./geo";

export type { End };

/** where: pick the ends. pick: choose stops. trip: the planned days. build: the builder from scratch. */
export type TripStep = "where" | "pick" | "trip" | "build";

export type RoadTrip = {
  step: TripStep;
  /** null means "my location", resolved when the search runs. */
  from: End | null;
  to: End | null;
  /** The start the search actually ran from, so "my location" stays put on refresh. */
  ranFrom?: End;
  days: number;
  picked: string[];
};

export const EXAMPLES: { from: End; to: End }[] = [
  {
    from: { name: "Pune", lat: 18.5204, lng: 73.8567 },
    to: { name: HOME_CITY.name, lat: HOME_CITY.lat, lng: HOME_CITY.lng },
  },
  {
    from: { name: HOME_CITY.name, lat: HOME_CITY.lat, lng: HOME_CITY.lng },
    to: { name: "Ajanta Caves", lat: 20.5519, lng: 75.7033 },
  },
];

const KEY = "citycake:road-trip";
const INITIAL: RoadTrip = { step: "where", from: null, to: null, days: 2, picked: [] };

let current: RoadTrip | null = null;
const listeners = new Set<() => void>();

function load(): RoadTrip {
  if (current) return current;
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(KEY);
    current = raw ? { ...INITIAL, ...(JSON.parse(raw) as Partial<RoadTrip>) } : INITIAL;
  } catch {
    current = INITIAL;
  }
  // A saved step past "where" needs both ends.
  if (current.step !== "build" && current.step !== "where" && !(current.to && (current.from || current.ranFrom))) {
    current = { ...current, step: "where" };
  }
  return current;
}

export function setRoadTrip(next: Partial<RoadTrip> | ((t: RoadTrip) => Partial<RoadTrip>)) {
  const prev = load();
  const patch = typeof next === "function" ? next(prev) : next;
  current = { ...prev, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage blocked: the wizard still works for this visit.
  }
  listeners.forEach((l) => l());
}

export function useRoadTrip(): RoadTrip {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => INITIAL,
  );
}

/** Same rounding the server cache uses, so equal ends share a result. */
export const endsKey = (a: End, b: End) =>
  [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(3)).join(",");
