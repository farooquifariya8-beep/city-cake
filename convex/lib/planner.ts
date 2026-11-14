// Rule-based trip planner. Pure and deterministic: same input, same plan.
// No Convex runtime imports, so it can be tested alone (scripts/planner.test.ts).
// The rules are written down in docs/product.md under "Planner behaviour".

import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { dayValidator, prefsValidator, stopValidator } from "../schema";
import { CATEGORIES } from "./categories";
import type { CitySeed } from "./cities";

export type Prefs = Infer<typeof prefsValidator>;
export type Day = Infer<typeof dayValidator>;
export type Stop = Infer<typeof stopValidator>;
export type Budget = Prefs["budget"];
export type Pace = Prefs["pace"];

/** The fields the planner reads from a place row. */
export type PlannerPlace = {
  _id: Id<"places">;
  name: string;
  category: string;
  citySlug: string;
  lat: number;
  lng: number;
  score: number;
  openingHours?: string;
};

export type PlanInput = {
  prefs: Prefs;
  places: PlannerPlace[];
  cities: CitySeed[];
  /** City for day 1. Defaults to the city with kind "home". */
  homeSlug?: string;
  /** "YYYY-MM-DD" for day 1. Only used to flag weekly closures on the right day. */
  startDate?: string;
};

export type Plan = { title: string; days: Day[]; estCostInr: number };

// ---------------------------------------------------------------------------
// Rule tables

/** Total stops per day, lunch included. */
export const STOPS_PER_PACE: Record<Pace, number> = { relaxed: 3, balanced: 4, packed: 6 };

/** Minutes spent at a stop, by category. */
export const DURATION_MIN: Record<string, number> = {
  heritage: 90,
  museum: 75,
  attraction: 60,
  religious: 40,
  park: 60,
  shopping: 60,
  food: 60,
  cafe: 40,
};
const DEFAULT_DURATION_MIN = 60;

/** Straight-line speeds used for travel estimates. */
export const SPEED_KMH = { inCity: 25, betweenTowns: 45 };

/** Day trips in order of value. Places from every listed city share one day. */
export const DAY_TRIPS: { slugs: string[]; title: string; short: string }[] = [
  { slugs: ["ellora", "daulatabad"], title: "Ellora and Daulatabad", short: "Ellora" },
  { slugs: ["ajanta"], title: "Ajanta", short: "Ajanta" },
  { slugs: ["paithan"], title: "Paithan", short: "Paithan" },
  { slugs: ["lonar"], title: "Lonar", short: "Lonar" },
  { slugs: ["jalna"], title: "Jalna", short: "Jalna" },
];

/**
 * Weekly closures of the main cave sites. 0 is Sunday. Applied to heritage stops in
 * that city within `radiusKm` of the caves, so the Khuldabad tombs aren't flagged.
 */
export const WEEKLY_CLOSURES: Record<
  string,
  { weekday: number; dayName: string; lat: number; lng: number; radiusKm: number }
> = {
  ajanta: { weekday: 1, dayName: "Monday", lat: 20.5526, lng: 75.7033, radiusKm: 3 },
  ellora: { weekday: 2, dayName: "Tuesday", lat: 20.0258, lng: 75.178, radiusKm: 2 },
};

/** A drive from the home city at least this long is called a long drive. */
const LONG_DRIVE_MIN = 60;

/** Categories never picked as a sight. Food and cafe are used for lunch unless the user asks for them. */
const NEVER_A_SIGHT = new Set(["stay"]);
const LUNCH_CATEGORIES = new Set(["food", "cafe"]);

const DEFAULT_START = 9 * 60;
const LUNCH_EARLIEST = 12 * 60 + 30;
const LUNCH_LATEST_END = 13 * 60 + 45; // put lunch in before a sight that would run past this
const NO_LUNCH_AFTER = 14 * 60; // a day that starts this late skips lunch

/**
 * Rough cost for the whole group, in INR. Per person, at 2026 prices, kept simple:
 * - food and local transport per day,
 * - an extra transport charge on a day trip day (shared car or bus to the site),
 * - a room share per night (days - 1 nights),
 * - entry fees per heritage or museum stop at the ASI Indian-visitor rate (about ₹40;
 *   the foreign-visitor rate at Ajanta and Ellora is ₹600 and is not used here).
 */
export const COST_TABLE: Record<
  Budget,
  { foodPerDay: number; transportPerDay: number; dayTripExtra: number; stayPerNight: number }
> = {
  shoestring: { foodPerDay: 400, transportPerDay: 250, dayTripExtra: 400, stayPerNight: 600 },
  comfort: { foodPerDay: 900, transportPerDay: 700, dayTripExtra: 1000, stayPerNight: 1800 },
  splurge: { foodPerDay: 2000, transportPerDay: 1800, dayTripExtra: 2500, stayPerNight: 5000 },
};
export const ENTRY_FEE_INR: Record<string, number> = { heritage: 40, museum: 40 };

// ---------------------------------------------------------------------------
// Helpers

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

type Point = { lat: number; lng: number };

/** Minutes between two points, rounded up to 5. */
export function travelMinutes(a: Point, b: Point, sameTown: boolean) {
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const speed = sameTown ? SPEED_KMH.inCity : SPEED_KMH.betweenTowns;
  return Math.max(5, Math.ceil(((km / speed) * 60) / 5) * 5);
}

function parseTime(s: string | undefined): number {
  const m = s ? /^(\d{1,2}):(\d{2})$/.exec(s.trim()) : null;
  if (!m) return DEFAULT_START;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return DEFAULT_START;
  return h * 60 + min;
}

function formatTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatKm(km: number) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Weekday (0 Sunday) of day `offset` after `startDate`, or null without a valid date. */
function weekdayOf(startDate: string | undefined, offset: number): number | null {
  const m = startDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate) : null;
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + offset);
  return Number.isNaN(t) ? null : new Date(t).getUTCDay();
}

function durationFor(category: string) {
  return DURATION_MIN[category] ?? DEFAULT_DURATION_MIN;
}

function isFacility(category: string) {
  const c = (CATEGORIES as Record<string, { group: string }>)[category];
  return c?.group === "facility";
}

/** Highest score first, ties broken by name then id so the order never depends on input order. */
function byScore(a: PlannerPlace, b: PlannerPlace) {
  return b.score - a.score || a.name.localeCompare(b.name) || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Planner

type DayPlanSpec = { cities: CitySeed[]; title: string; isTrip: boolean; short?: string };

export function planTrip(input: PlanInput): Plan {
  const { prefs, cities } = input;
  const days = clamp(prefs.days, 1, 5);
  const groupSize = clamp(prefs.groupSize, 1, 12);
  const perDay = STOPS_PER_PACE[prefs.pace] ?? STOPS_PER_PACE.balanced;
  const startMin = parseTime(prefs.startTime);
  const interests = new Set(prefs.interests);

  const home =
    cities.find((c) => c.slug === input.homeSlug) ??
    cities.find((c) => c.kind === "home") ??
    cities[0];
  if (!home) return { title: "No plan", days: [], estCostInr: 0 };

  // Explore places only, deduplicated by id, in a stable order.
  const seen = new Set<string>();
  const places = input.places
    .filter((p) => !isFacility(p.category))
    .filter((p) => (seen.has(p._id) ? false : (seen.add(p._id), true)))
    .sort(byScore);

  const bySlug = new Map(cities.map((c) => [c.slug, c]));
  const hasPlaces = (slug: string) => places.some((p) => p.citySlug === slug);

  // Which town each day goes to.
  const trips: DayPlanSpec[] = [];
  if (prefs.includeDayTrips && home.kind === "home") {
    for (const trip of DAY_TRIPS) {
      const tripCities = trip.slugs
        .map((s) => bySlug.get(s))
        .filter((c): c is CitySeed => !!c && hasPlaces(c.slug));
      if (tripCities.length === 0) continue;
      const title = tripCities.length === trip.slugs.length ? trip.title : tripCities[0].name;
      trips.push({ cities: tripCities, title, isTrip: true, short: trip.short });
    }
  }
  const specs: DayPlanSpec[] = [];
  for (let d = 0; d < days; d++) {
    const trip = d > 0 ? trips[d - 1] : undefined;
    specs.push(trip ?? { cities: [home], title: home.name, isTrip: false });
  }

  const used = new Set<string>();
  const outDays: Day[] = specs.map((spec, i) =>
    planDay({
      dayNumber: i + 1,
      spec,
      home,
      places,
      used,
      interests,
      perDay,
      startMin,
      weekday: weekdayOf(input.startDate, i),
    }),
  );

  // Title: "3 days in Chhatrapati Sambhajinagar, Ellora and Ajanta".
  const names = [home.name];
  for (const s of specs) if (s.isTrip && s.short && !names.includes(s.short)) names.push(s.short);
  const where = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const title = `${days} ${days === 1 ? "day" : "days"} in ${where}`;

  return { title, days: outDays, estCostInr: estimateCost(prefs.budget, groupSize, specs, outDays) };
}

function planDay(args: {
  dayNumber: number;
  spec: DayPlanSpec;
  home: CitySeed;
  places: PlannerPlace[];
  used: Set<string>;
  interests: Set<string>;
  perDay: number;
  startMin: number;
  weekday: number | null;
}): Day {
  const { dayNumber, spec, home, places, used, interests, perDay, startMin, weekday } = args;
  const slugs = new Set(spec.cities.map((c) => c.slug));
  const here = places.filter((p) => slugs.has(p.citySlug) && !used.has(p._id));

  const canBeSight = (p: PlannerPlace) =>
    !NEVER_A_SIGHT.has(p.category) && (!LUNCH_CATEGORIES.has(p.category) || interests.has(p.category));
  const lunchPool = here.filter((p) => LUNCH_CATEGORIES.has(p.category));
  const wantLunch = startMin < NO_LUNCH_AFTER && lunchPool.length > 0;
  const sightCount = Math.max(1, perDay - (wantLunch ? 1 : 0));

  // Pick sights: interest matches first, then the top-scored rest. On a combined
  // day trip, the best place of each town goes in first so no town is skipped.
  const sights = here.filter(canBeSight);
  const ranked = [
    ...sights.filter((p) => interests.has(p.category)),
    ...sights.filter((p) => !interests.has(p.category)),
  ];
  const picked: PlannerPlace[] = [];
  if (spec.cities.length > 1) {
    for (const c of spec.cities) {
      const best = ranked.find((p) => p.citySlug === c.slug);
      if (best && picked.length < sightCount) picked.push(best);
    }
  }
  for (const p of ranked) {
    if (picked.length >= sightCount) break;
    if (!picked.includes(p)) picked.push(p);
  }

  // Order by nearest neighbour. A city day starts at its best pick; a day trip
  // starts at the pick nearest the home city, since that's where the drive ends.
  const origin: Point = home;
  const ordered: PlannerPlace[] = [];
  const left = [...picked];
  if (left.length > 0) {
    let firstIdx = 0;
    if (spec.isTrip) {
      let best = Infinity;
      left.forEach((p, idx) => {
        const d = haversineKm(origin.lat, origin.lng, p.lat, p.lng);
        if (d < best) [best, firstIdx] = [d, idx];
      });
    }
    ordered.push(...left.splice(firstIdx, 1));
    while (left.length > 0) {
      const last = ordered[ordered.length - 1];
      let best = Infinity;
      let idx = 0;
      left.forEach((p, j) => {
        const d = haversineKm(last.lat, last.lng, p.lat, p.lng);
        if (d < best) [best, idx] = [d, j];
      });
      ordered.push(...left.splice(idx, 1));
    }
  }
  for (const p of ordered) used.add(p._id);

  // Lay out the clock, slotting lunch in near 13:00.
  const stops: Stop[] = [];
  let clock = startMin;
  let prev: PlannerPlace | null = null;
  let lunchDone = !wantLunch;

  const leg = (from: PlannerPlace | null, to: PlannerPlace) => {
    if (from) return { min: travelMinutes(from, to, from.citySlug === to.citySlug), km: haversineKm(from.lat, from.lng, to.lat, to.lng) };
    if (spec.isTrip) return { min: travelMinutes(origin, to, false), km: haversineKm(origin.lat, origin.lng, to.lat, to.lng) };
    return null;
  };

  const place = (p: PlannerPlace, opts: { lunch?: boolean; notBefore?: number } = {}) => {
    const t = leg(prev, p);
    let start = clock + (t?.min ?? 0);
    if (opts.notBefore !== undefined) start = Math.max(start, opts.notBefore);
    const durationMin = durationFor(p.category);
    const notes: string[] = [];
    if (!prev && t) {
      const drive = `about ${formatKm(t.km)} and ${formatDuration(t.min)} from ${home.name}, estimated.`;
      notes.push(
        t.min >= LONG_DRIVE_MIN
          ? `Long drive, ${drive} Leave by ${formatTime(clock)}.`
          : `Drive ${drive}`,
      );
    } else if (opts.lunch && prev) {
      notes.push(`Lunch, ${formatKm(t!.km)} from ${prev.name}.`);
    } else if (prev && prev.citySlug !== p.citySlug) {
      notes.push(`Drive of about ${formatDuration(t!.min)} from ${prev.name}.`);
    }
    const closure = WEEKLY_CLOSURES[p.citySlug];
    if (
      closure &&
      p.category === "heritage" &&
      haversineKm(closure.lat, closure.lng, p.lat, p.lng) <= closure.radiusKm
    ) {
      notes.push(
        weekday === closure.weekday
          ? `Closed on ${closure.dayName}s, and this day is a ${closure.dayName}. Move this day.`
          : `Closed on ${closure.dayName}s.`,
      );
    }
    stops.push({
      placeId: p._id,
      name: p.name,
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      start: formatTime(start),
      durationMin,
      ...(t ? { travelMin: t.min } : {}),
      ...(notes.length ? { note: notes.join(" ") } : {}),
    });
    used.add(p._id);
    clock = start + durationMin;
    prev = p;
  };

  const placeLunch = () => {
    lunchDone = true;
    const from: Point | null = prev ?? (spec.isTrip ? origin : home);
    const pool = lunchPool.filter((p) => !used.has(p._id));
    if (pool.length === 0 || !from) return;
    let best = pool[0];
    let bestD = Infinity;
    for (const p of pool) {
      const d = haversineKm(from.lat, from.lng, p.lat, p.lng);
      if (d < bestD) [bestD, best] = [d, p];
    }
    place(best, { lunch: true, notBefore: LUNCH_EARLIEST });
  };

  for (const p of ordered) {
    if (!lunchDone && prev) {
      const t = leg(prev, p);
      const arrive = clock + (t?.min ?? 0);
      if (arrive >= LUNCH_EARLIEST || arrive + durationFor(p.category) > LUNCH_LATEST_END) placeLunch();
    }
    place(p);
  }
  if (!lunchDone) placeLunch();

  // On a day trip, say how long the drive back is.
  if (spec.isTrip && prev && stops.length > 0) {
    const last = prev as PlannerPlace;
    const back = travelMinutes(last, origin, false);
    const stop = stops[stops.length - 1];
    const line = `Drive back to ${home.name} takes about ${formatDuration(back)}.`;
    stop.note = stop.note ? `${stop.note} ${line}` : line;
  }

  return { day: dayNumber, title: spec.title, citySlug: spec.cities[0].slug, stops };
}

function estimateCost(budget: Budget, groupSize: number, specs: DayPlanSpec[], days: Day[]) {
  const c = COST_TABLE[budget] ?? COST_TABLE.comfort;
  const n = days.length;
  let perPerson = n * (c.foodPerDay + c.transportPerDay) + Math.max(0, n - 1) * c.stayPerNight;
  perPerson += specs.filter((s) => s.isTrip).length * c.dayTripExtra;
  for (const d of days) for (const s of d.stops) perPerson += ENTRY_FEE_INR[s.category] ?? 0;
  return Math.round((perPerson * groupSize) / 100) * 100;
}
