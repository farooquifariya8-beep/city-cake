"use client";

import { useMemo } from "react";
import type { PlaceCard } from "@/convex/places";
import { CATEGORIES } from "@/convex/lib/categories";
import { useDraft } from "./plan-draft";
import { useRoadTrip } from "./road-trip";

/** The trip the assistant knows about: the wizard ends and the draft's stops. */
export type TripContext = {
  from?: string;
  to?: string;
  fromAt?: { lat: number; lng: number };
  toAt?: { lat: number; lng: number };
  days: number;
  stops: { name: string; day: number; category: string; lat: number; lng: number }[];
};

const MAX_STOPS = 20;

export function useTripContext(): TripContext | null {
  const road = useRoadTrip();
  const draft = useDraft();
  return useMemo(() => {
    const start = road.ranFrom ?? road.from;
    const hasEnds = road.step !== "build" && !!road.to && !!start;
    const stops = draft.days
      .flatMap((d, i) => d.stops.map((s) => ({ name: s.name, day: i + 1, category: s.category, lat: s.lat, lng: s.lng })))
      .slice(0, MAX_STOPS);
    if (!hasEnds && stops.length === 0) return null;
    return {
      from: hasEnds ? start!.name : undefined,
      to: hasEnds ? road.to!.name : undefined,
      fromAt: hasEnds ? { lat: start!.lat, lng: start!.lng } : undefined,
      toAt: hasEnds ? { lat: road.to!.lat, lng: road.to!.lng } : undefined,
      days: stops.length ? draft.days.length : road.days,
      stops,
    };
  }, [road, draft]);
}

const isSight = (c: string) =>
  (CATEGORIES as Record<string, { group: string }>)[c]?.group === "explore" && c !== "food" && c !== "stay";
const uniq = (xs: string[]) => [...new Set(xs)];

/** Four or five empty-state questions built from the trip. */
export function tripSuggestions(t: TripContext): string[] {
  const out: string[] = [];
  const sights = t.stops.filter((s) => isSight(s.category));
  const firstSight = sights[0];
  const day1 = t.stops.filter((s) => s.day === 1);
  const lastDay1 = day1[day1.length - 1];
  const otherSight = sights.find((s) => s.name !== firstSight?.name);

  if (firstSight) out.push(`What should I eat near ${firstSight.name}?`);
  if (otherSight) out.push(`Is ${otherSight.name} open on Monday?`);
  else if (firstSight) out.push(`Is ${firstSight.name} open on Monday?`);
  if (t.from && t.to) out.push(`How long is the drive from ${t.from} to ${t.to}?`);
  if (lastDay1) out.push(`Where can I stay near ${lastDay1.name}?`);
  if (t.from && t.to) out.push(`What's worth seeing between ${t.from} and ${t.to}?`);
  if (out.length < 4 && t.stops.length >= 2) {
    const a = t.stops[0];
    const b = t.stops[t.stops.length - 1];
    if (a.name !== b.name) out.push(`How long is the drive from ${a.name} to ${b.name}?`);
  }
  if (out.length < 4 && firstSight) out.push(`Where is the nearest pharmacy to ${firstSight.name}?`);
  return uniq(out).slice(0, 5);
}

/** Two or three follow-ups after a reply, from the places it returned or the trip. */
export function followUps(places: PlaceCard[], t: TripContext | null): string[] {
  const out: string[] = [];
  const sight = places.find((p) => isSight(p.category));
  const food = places.find((p) => p.category === "food");
  if (sight) out.push(`What should I eat near ${sight.name}?`);
  if (food) out.push(`What's worth seeing near ${food.name}?`);
  if (places[0]) out.push(`How long is the drive to ${places[0].name}?`);
  if (t) {
    const stop = t.stops.find((s) => !places.some((p) => p.name === s.name));
    if (stop) out.push(`Is ${stop.name} open on Monday?`);
    if (t.from && t.to) out.push(`What's worth seeing between ${t.from} and ${t.to}?`);
  }
  if (out.length < 2) out.push("Where can I stay in the city?", "What should I see in one day here?");
  return uniq(out).slice(0, 3);
}
