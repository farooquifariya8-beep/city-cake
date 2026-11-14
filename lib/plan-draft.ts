"use client";

import { useSyncExternalStore } from "react";
import type { Infer } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import type { dayValidator, prefsValidator } from "@/convex/schema";
import { DURATION_MIN, travelMinutes } from "@/convex/lib/planner";
import { addMinutes } from "./format";
import { HOME_CITY, nearestCity } from "./geo";

export type Prefs = Infer<typeof prefsValidator>;
export type SavedDay = Infer<typeof dayValidator>;

export type DraftStop = {
  key: string;
  placeId?: Id<"places">;
  name: string;
  category: string;
  lat: number;
  lng: number;
  start: string;
  durationMin: number;
  note?: string;
};

export type DraftDay = { key: string; title: string; citySlug: string; stops: DraftStop[] };

export type Draft = {
  title: string;
  days: DraftDay[];
  activeDay: number;
  prefs?: Prefs;
  estCostInr?: number;
  /** Set when the draft edits a saved itinerary. */
  editingId?: Id<"itineraries">;
};

const KEY = "citycake:plan-draft";
const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyDay = (n: number): DraftDay => ({
  key: uid(),
  title: `Day ${n}`,
  citySlug: HOME_CITY.slug,
  stops: [],
});

export const EMPTY_DRAFT: Draft = { title: "My trip", days: [emptyDay(1)], activeDay: 0 };

let current: Draft | null = null;
const listeners = new Set<() => void>();

function load(): Draft {
  if (current) return current;
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as Draft) : EMPTY_DRAFT;
    if (!current.days?.length) current = EMPTY_DRAFT;
  } catch {
    current = EMPTY_DRAFT;
  }
  return current;
}

export function setDraft(next: Draft | ((d: Draft) => Draft)) {
  const value = typeof next === "function" ? next(load()) : next;
  current = { ...value, activeDay: Math.min(Math.max(0, value.activeDay), value.days.length - 1) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage full or blocked: the draft still lives for this session.
  }
  listeners.forEach((l) => l());
}

export function useDraft(): Draft {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => EMPTY_DRAFT,
  );
}

export const durationFor = (category: string) =>
  (DURATION_MIN as Record<string, number>)[category] ?? 60;

/** Estimated minutes from one stop to the next, with the planner's speeds. */
export function travelBetween(a: DraftStop, b: DraftStop): number {
  const sameTown = nearestCity(a.lat, a.lng).city.slug === nearestCity(b.lat, b.lng).city.slug;
  return travelMinutes(a, b, sameTown);
}

/** Append a stop to a day, starting when the previous one ends plus travel. */
export function addStop(
  dayIndex: number,
  stop: Omit<DraftStop, "key" | "start" | "durationMin"> & { durationMin?: number },
) {
  setDraft((d) => {
    const days = d.days.map((day, i) => {
      if (i !== dayIndex) return day;
      const prev = day.stops[day.stops.length - 1];
      const next: DraftStop = {
        ...stop,
        key: uid(),
        durationMin: stop.durationMin ?? durationFor(stop.category),
        start: "09:00",
      };
      if (prev) next.start = addMinutes(prev.start, prev.durationMin + travelBetween(prev, next));
      const citySlug = day.stops.length === 0 ? nearestCity(next.lat, next.lng).city.slug : day.citySlug;
      return { ...day, citySlug, stops: [...day.stops, next] };
    });
    return { ...d, days };
  });
}

/** Builder draft from a generated or saved plan. */
export function draftFromPlan(plan: {
  title: string;
  days: SavedDay[];
  prefs?: Prefs;
  estCostInr?: number;
  editingId?: Id<"itineraries">;
}): Draft {
  return {
    title: plan.title,
    prefs: plan.prefs,
    estCostInr: plan.estCostInr,
    editingId: plan.editingId,
    activeDay: 0,
    days: plan.days.map((d) => ({
      key: uid(),
      title: d.title,
      citySlug: d.citySlug,
      stops: d.stops.map((s) => ({
        placeId: s.placeId,
        name: s.name,
        category: s.category,
        lat: s.lat,
        lng: s.lng,
        start: s.start,
        durationMin: s.durationMin,
        note: s.note,
        key: uid(),
      })),
    })),
  };
}

/** The shape itineraries.save and update take, with travel recomputed. */
export function draftToDays(d: Draft): SavedDay[] {
  return d.days.map((day, i) => ({
    day: i + 1,
    title: day.title,
    citySlug: day.citySlug,
    stops: day.stops.map((s, j) => ({
      ...(s.placeId ? { placeId: s.placeId } : {}),
      name: s.name,
      category: s.category,
      lat: s.lat,
      lng: s.lng,
      start: s.start,
      durationMin: s.durationMin,
      ...(j > 0 ? { travelMin: travelBetween(day.stops[j - 1], s) } : {}),
      ...(s.note ? { note: s.note } : {}),
    })),
  }));
}

export const newKey = uid;
