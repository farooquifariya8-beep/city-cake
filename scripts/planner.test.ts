// Run with `bun test scripts/planner.test.ts`.
import { describe, expect, test } from "bun:test";
import type { Id } from "../convex/_generated/dataModel";
import { CITIES } from "../convex/lib/cities";
import { planTrip, STOPS_PER_PACE, type PlannerPlace, type Prefs } from "../convex/lib/planner";

let n = 0;
const P = (
  citySlug: string,
  name: string,
  category: string,
  lat: number,
  lng: number,
  score: number,
): PlannerPlace => ({ _id: `p${++n}` as Id<"places">, citySlug, name, category, lat, lng, score });

const PLACES: PlannerPlace[] = [
  P("sambhajinagar", "Bibi Ka Maqbara", "heritage", 19.9015, 75.3203, 95),
  P("sambhajinagar", "Aurangabad Caves", "heritage", 19.9105, 75.3135, 80),
  P("sambhajinagar", "Panchakki", "attraction", 19.8901, 75.3197, 75),
  P("sambhajinagar", "Siddharth Garden", "park", 19.8794, 75.3341, 55),
  P("sambhajinagar", "Chhatrapati Shivaji Maharaj Museum", "museum", 19.8869, 75.3238, 60),
  P("sambhajinagar", "Bhadkal Gate", "heritage", 19.8858, 75.3294, 50),
  P("sambhajinagar", "Himroo weaving workshop", "shopping", 19.8925, 75.3301, 45),
  P("sambhajinagar", "Salim Ali Lake", "park", 19.9002, 75.3338, 40),
  P("sambhajinagar", "Shahganj Masjid", "religious", 19.8889, 75.3333, 35),
  P("sambhajinagar", "Bhoj Thali House", "food", 19.878, 75.34, 50),
  P("sambhajinagar", "Naan Qaliya Corner", "food", 19.895, 75.325, 48),
  P("sambhajinagar", "Station Road Cafe", "cafe", 19.865, 75.32, 30),
  P("sambhajinagar", "City Pharmacy", "pharmacy", 19.88, 75.34, 99),
  P("sambhajinagar", "Hotel Rama", "stay", 19.87, 75.33, 90),
  P("ellora", "Kailasa Temple, Cave 16", "heritage", 20.0244, 75.1791, 100),
  P("ellora", "Ellora Jain Caves", "heritage", 20.0301, 75.1795, 70),
  P("ellora", "Grishneshwar Temple", "religious", 20.0249, 75.1699, 85),
  P("ellora", "Tomb of Aurangzeb", "heritage", 20.0065, 75.1925, 60),
  P("ellora", "Kailas Restaurant", "food", 20.023, 75.178, 40),
  P("daulatabad", "Daulatabad Fort", "heritage", 19.943, 75.2132, 90),
  P("daulatabad", "Chand Minar", "heritage", 19.9405, 75.214, 65),
  P("ajanta", "Ajanta Caves", "heritage", 20.5523, 75.7004, 100),
  P("ajanta", "Ajanta Viewpoint", "attraction", 20.5567, 75.7066, 60),
  P("ajanta", "Ajanta Visitor Centre", "museum", 20.531, 75.747, 40),
  P("ajanta", "MTDC Restaurant Ajanta", "food", 20.533, 75.745, 30),
];

const base: Prefs = {
  days: 3,
  budget: "comfort",
  interests: [],
  groupSize: 2,
  pace: "balanced",
  includeDayTrips: true,
};
const plan = (over: Partial<Prefs> = {}, startDate?: string) =>
  planTrip({ prefs: { ...base, ...over }, places: PLACES, cities: CITIES, startDate });

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const byId = new Map(PLACES.map((p) => [p._id as string, p]));
const cityOf = (id: string | undefined) => byId.get(id ?? "")?.citySlug;

describe("planTrip", () => {
  test("is deterministic, also when input order changes", () => {
    const a = plan();
    const b = planTrip({
      prefs: { ...base },
      places: [...PLACES].reverse(),
      cities: [...CITIES].reverse(),
    });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  test("day 1 stays in the city", () => {
    const p = plan();
    expect(p.days[0].citySlug).toBe("sambhajinagar");
    for (const s of p.days[0].stops) expect(cityOf(s.placeId)).toBe("sambhajinagar");
  });

  test("stop counts follow the pace", () => {
    for (const pace of ["relaxed", "balanced", "packed"] as const) {
      const p = plan({ pace, days: 1 });
      expect(p.days[0].stops.length).toBe(STOPS_PER_PACE[pace]);
    }
  });

  test("each day has one lunch stop near 13:00", () => {
    for (const pace of ["relaxed", "balanced", "packed"] as const) {
      for (const day of plan({ pace }).days) {
        const lunches = day.stops.filter((s) => s.category === "food" || s.category === "cafe");
        expect(lunches.length).toBe(1);
        expect(Math.abs(toMin(lunches[0].start) - 13 * 60)).toBeLessThanOrEqual(60);
      }
    }
  });

  test("never repeats a place and skips facilities and stays", () => {
    const p = plan({ days: 5, pace: "packed" });
    const ids = p.days.flatMap((d) => d.stops.map((s) => s.placeId));
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of p.days)
      for (const s of d.stops) expect(["pharmacy", "stay"]).not.toContain(s.category);
  });

  test("day trips only when includeDayTrips is on", () => {
    const off = plan({ includeDayTrips: false });
    expect(off.days.map((d) => d.citySlug)).toEqual(["sambhajinagar", "sambhajinagar", "sambhajinagar"]);
    expect(off.title).toBe("3 days in Chhatrapati Sambhajinagar");

    const on = plan();
    expect(on.days.map((d) => d.citySlug)).toEqual(["sambhajinagar", "ellora", "ajanta"]);
    expect(on.title).toBe("3 days in Chhatrapati Sambhajinagar, Ellora and Ajanta");
    // Ellora and Daulatabad share a day.
    const towns = new Set(on.days[1].stops.map((s) => cityOf(s.placeId)));
    expect(towns).toEqual(new Set(["ellora", "daulatabad"]));
    // The first stop of a day trip carries the long drive.
    const first = on.days[2].stops[0];
    expect(first.travelMin).toBeGreaterThanOrEqual(90);
    expect(first.note).toContain("Long drive");
  });

  test("stops are in time order and travel is rounded to 5", () => {
    for (const day of plan({ pace: "packed" }).days) {
      let t = 0;
      for (const s of day.stops) {
        expect(toMin(s.start)).toBeGreaterThanOrEqual(t);
        t = toMin(s.start) + s.durationMin;
        if (s.travelMin !== undefined) expect(s.travelMin % 5).toBe(0);
      }
    }
  });

  test("notes the Ajanta Monday closure, and flags it on a Monday", () => {
    const find = (p: ReturnType<typeof plan>) =>
      p.days.flatMap((d) => d.stops).find((s) => s.name === "Ajanta Caves");
    expect(find(plan())?.note).toContain("Closed on Mondays.");
    // 2026-11-14 is a Saturday, so day 3 is Monday 2026-11-16.
    expect(find(plan({}, "2026-11-14"))?.note).toContain("this day is a Monday");
    expect(find(plan({}, "2026-11-13"))?.note).not.toContain("this day is a Monday");
  });

  test("interests come first, then the top-scored rest", () => {
    const p = plan({ days: 1, pace: "packed", interests: ["park"], includeDayTrips: false });
    const stops = p.days[0].stops;
    expect(stops.filter((s) => s.category === "park").length).toBe(2);
    expect(stops.map((s) => s.name)).toContain("Bibi Ka Maqbara");
  });

  test("output matches the schema shape", () => {
    const p = plan({ days: 5, pace: "packed" });
    expect(typeof p.title).toBe("string");
    expect(Number.isInteger(p.estCostInr)).toBe(true);
    expect(p.estCostInr).toBeGreaterThan(0);
    const dayKeys = ["citySlug", "day", "stops", "title"];
    const stopKeys = new Set([
      "placeId", "name", "category", "lat", "lng", "start", "durationMin", "travelMin", "note",
    ]);
    p.days.forEach((d, i) => {
      expect(Object.keys(d).sort()).toEqual(dayKeys);
      expect(d.day).toBe(i + 1);
      for (const s of d.stops) {
        for (const k of Object.keys(s)) expect(stopKeys.has(k)).toBe(true);
        expect(s.start).toMatch(/^\d{2}:\d{2}$/);
        expect(typeof s.lat).toBe("number");
        if (s.note) {
          expect(s.note).not.toContain("!");
          expect(s.note).not.toContain("—");
        }
      }
    });
  });

  test("cost scales with group size and budget", () => {
    expect(plan({ groupSize: 4 }).estCostInr).toBeGreaterThan(plan({ groupSize: 2 }).estCostInr);
    expect(plan({ budget: "splurge" }).estCostInr).toBeGreaterThan(
      plan({ budget: "shoestring" }).estCostInr,
    );
  });
});
