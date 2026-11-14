// Route trip planning: places along a road route, then days from the ones the
// user picked. Pure: no Convex imports, so the browser uses it too.
import type { Infer } from "convex/values";
import type { dayValidator } from "../schema";
import { DURATION_MIN } from "./planner";

export type SavedDay = Infer<typeof dayValidator>;
export type LngLat = [number, number];
export type End = { name: string; lat: number; lng: number };

export type RouteStop = {
  key: string; // osmId, or "place:<id>"
  placeId?: string;
  osmId?: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  kmAlong: number; // where along the route it sits
  offKm: number; // straight-line distance from the road
  image?: string;
  score: number;
};

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
export function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Keep at most `max` points, evenly spaced, always with both ends. */
export function thin(coords: LngLat[], max: number): LngLat[] {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => coords[Math.round(i * step)]);
}

/** Cumulative km at each vertex. */
export function cumulative(coords: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + km(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]));
  }
  return out;
}

/** Nearest point on the route: km along it, and km off it. Good enough at city scale. */
export function project(coords: LngLat[], cum: number[], lat: number, lng: number) {
  let best = { kmAlong: 0, offKm: Infinity };
  const kx = Math.cos(rad(lat)) * 111.32;
  const ky = 110.57;
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = [coords[i - 1][0] * kx, coords[i - 1][1] * ky];
    const [bx, by] = [coords[i][0] * kx, coords[i][1] * ky];
    const [px, py] = [lng * kx, lat * ky];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const off = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (off < best.offKm) best = { kmAlong: cum[i - 1] + t * (cum[i] - cum[i - 1]), offKm: off };
  }
  return best;
}

const DAY_START_MIN = 9 * 60;
const DAY_END_MIN = 19 * 60;
const DETOUR_KMH = 30;

function hhmm(min: number) {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
const round5 = (n: number) => Math.max(5, Math.ceil(n / 5) * 5);

/**
 * Days for a road trip. Picked stops go in route order. Each day runs from
 * 09:00, ends near 19:00, and prefers to end at a picked stay.
 */
export function planRouteTrip(input: {
  from: End;
  to: End;
  days: number;
  route: { distanceM: number; durationS: number };
  stops: RouteStop[];
}): { title: string; days: SavedDay[] } {
  const totalKm = input.route.distanceM / 1000;
  const kmh = input.route.durationS > 0 ? Math.max(20, totalKm / (input.route.durationS / 3600)) : 45;
  const ordered = [...input.stops].sort((a, b) => a.kmAlong - b.kmAlong);
  const visit = (s: RouteStop) => (DURATION_MIN as Record<string, number>)[s.category] ?? 45;

  type Leg = { stop: RouteStop | null; driveMin: number; visitMin: number };
  const legs: Leg[] = [];
  let prevKm = 0;
  let prevOff = 0;
  for (const s of ordered) {
    const drive = (Math.max(0, s.kmAlong - prevKm) / kmh) * 60 + ((prevOff + s.offKm) / DETOUR_KMH) * 60;
    legs.push({ stop: s, driveMin: round5(drive), visitMin: s.category === "stay" ? 0 : visit(s) });
    prevKm = s.kmAlong;
    prevOff = s.offKm;
  }
  legs.push({ stop: null, driveMin: round5((Math.max(0, totalKm - prevKm) / kmh) * 60 + (prevOff / DETOUR_KMH) * 60), visitMin: 0 });

  const total = legs.reduce((n, l) => n + l.driveMin + l.visitMin, 0);
  const days = Math.max(1, Math.min(7, Math.round(input.days)));
  const target = total / days;

  // Split legs into days: break at the leg closest to each day's share,
  // preferring a picked stay within a quarter of the target.
  const breaks: number[] = [];
  let acc = 0;
  const accAt: number[] = [];
  for (const l of legs) {
    acc += l.driveMin + l.visitMin;
    accAt.push(acc);
  }
  for (let d = 1; d < days; d++) {
    const goal = target * d;
    let best = -1;
    let bestCost = Infinity;
    for (let i = (breaks.at(-1) ?? -1) + 1; i < legs.length - 1; i++) {
      const isStay = legs[i].stop?.category === "stay";
      const cost = Math.abs(accAt[i] - goal) - (isStay && Math.abs(accAt[i] - goal) < target * 0.25 ? target : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    if (best >= 0) breaks.push(best);
  }

  const out: SavedDay[] = [];
  let start = 0;
  const groups: Leg[][] = [];
  for (const b of breaks) {
    groups.push(legs.slice(start, b + 1));
    start = b + 1;
  }
  groups.push(legs.slice(start));
  while (groups.length < days) groups.push([]);

  let lastName = input.from.name;
  let lastPoint: End = input.from;
  groups.forEach((g, i) => {
    let t = DAY_START_MIN;
    const stops: SavedDay["stops"] = [
      {
        name: i === 0 ? input.from.name : lastName,
        category: i === 0 ? "attraction" : "stay",
        lat: lastPoint.lat,
        lng: lastPoint.lng,
        start: hhmm(t),
        durationMin: 15,
        note: i === 0 ? "Start" : "Leave after breakfast",
      },
    ];
    t += 15;
    for (const l of g) {
      t += l.driveMin;
      const s = l.stop;
      if (!s) {
        stops.push({
          name: input.to.name,
          category: "attraction",
          lat: input.to.lat,
          lng: input.to.lng,
          start: hhmm(t),
          durationMin: 30,
          travelMin: l.driveMin,
          note: "Arrive",
        });
        lastName = input.to.name;
        lastPoint = input.to;
        continue;
      }
      stops.push({
        ...(s.placeId ? { placeId: s.placeId as SavedDay["stops"][number]["placeId"] } : {}),
        name: s.name,
        category: s.category,
        lat: s.lat,
        lng: s.lng,
        start: hhmm(t),
        durationMin: s.category === "stay" ? 30 : l.visitMin,
        travelMin: l.driveMin,
        note: s.category === "stay" ? "Overnight" : t > DAY_END_MIN ? "Late in the day, consider moving it" : undefined,
      });
      t += l.visitMin;
      lastName = s.name;
      lastPoint = s;
    }
    out.push({
      day: i + 1,
      title: g.length === 0 ? `Day ${i + 1}: at ${lastName}` : `Day ${i + 1}: to ${lastName}`,
      citySlug: "route",
      stops: stops.map((x) => (x.note === undefined ? (({ note: _n, ...rest }) => rest)(x) : x)),
    });
  });

  return { title: `${input.from.name} to ${input.to.name}, ${days} ${days === 1 ? "day" : "days"}`, days: out };
}
