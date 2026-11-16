// Routes between 2 to 10 points, from OSRM, cached in routeCache.
// The browser never calls OSRM; it calls routes.get. Policy: docs/data.md.

import { v, type Infer } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { navLegValidator, navStepValidator } from "./schema";

const USER_AGENT = "CityCake/0.1 (college project)";
// Convex arrays hold at most 8192 items; keep geometry well under that.
const MAX_COORDS = 4000;

const profileV = v.union(v.literal("driving"), v.literal("foot"));
type Profile = "driving" | "foot";

export type Route = {
  coordinates: [number, number][]; // [lng, lat]
  distanceM: number;
  durationS: number;
};

export type NavStep = Infer<typeof navStepValidator>;
export type NavLeg = Infer<typeof navLegValidator>;
/** A route with its turns, for driving it live. One leg per pair of points. */
export type NavRoute = Route & { legs: NavLeg[]; steps: NavStep[] };

/**
 * The OSRM demo server only runs the car profile (a /foot/ URL silently
 * returns the car route), so walking goes to the FOSSGIS foot instance only.
 * Each profile lists its endpoints in the order tried.
 */
const ENDPOINTS: Record<Profile, string[]> = {
  driving: [
    "https://router.project-osrm.org/route/v1/driving",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  ],
  foot: ["https://routing.openstreetmap.de/routed-foot/route/v1/driving"],
};

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

function cacheKey(profile: Profile, points: { lat: number; lng: number }[]) {
  return `${profile}:${points.map((p) => `${round5(p.lat)},${round5(p.lng)}`).join(";")}`;
}

export const getCached = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) =>
    ctx.db
      .query("routeCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique(),
});

export const store = internalMutation({
  args: {
    key: v.string(),
    profile: v.string(),
    coordinates: v.array(v.array(v.number())),
    distanceM: v.number(),
    durationS: v.number(),
    legs: v.optional(v.array(navLegValidator)),
    steps: v.optional(v.array(navStepValidator)),
  },
  handler: async (ctx, row) => {
    const existing = await ctx.db
      .query("routeCache")
      .withIndex("by_key", (q) => q.eq("key", row.key))
      .unique();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("routeCache", row);
  },
});

/** Keep every nth point plus the last one, so long routes fit in a document. */
function thin(coords: [number, number][]): [number, number][] {
  if (coords.length <= MAX_COORDS) return coords;
  const step = Math.ceil(coords.length / MAX_COORDS);
  const out = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

async function fetchRoute(base: string, path: string): Promise<Route | null> {
  const url = `${base}/${path}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    code?: string;
    routes?: {
      distance: number;
      duration: number;
      geometry?: { coordinates?: number[][] };
    }[];
  };
  const r = json.routes?.[0];
  const coords = r?.geometry?.coordinates;
  if (json.code !== "Ok" || !r || !coords || coords.length < 2) return null;
  return {
    coordinates: thin(coords.map((c) => [round5(c[0]), round5(c[1])] as [number, number])),
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
  };
}

type OsrmStep = {
  distance: number;
  duration: number;
  name?: string;
  ref?: string;
  maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] };
};

/** The same route with `steps=true`: legs and every maneuver on them. */
async function fetchNavRoute(base: string, path: string): Promise<NavRoute | null> {
  const url = `${base}/${path}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    code?: string;
    routes?: {
      distance: number;
      duration: number;
      geometry?: { coordinates?: number[][] };
      legs?: { distance: number; duration: number; steps?: OsrmStep[] }[];
    }[];
  };
  const r = json.routes?.[0];
  const coords = r?.geometry?.coordinates;
  if (json.code !== "Ok" || !r || !coords || coords.length < 2 || !r.legs?.length) return null;
  const steps: NavStep[] = r.legs.flatMap((leg, i) =>
    (leg.steps ?? []).map((st) => ({
      leg: i,
      type: st.maneuver.type,
      ...(st.maneuver.modifier ? { modifier: st.maneuver.modifier } : {}),
      ...(typeof st.maneuver.exit === "number" ? { exit: st.maneuver.exit } : {}),
      name: st.name ?? "",
      ...(st.ref ? { ref: st.ref } : {}),
      distanceM: Math.round(st.distance),
      durationS: Math.round(st.duration),
      lng: round5(st.maneuver.location[0]),
      lat: round5(st.maneuver.location[1]),
    })),
  );
  return {
    coordinates: thin(coords.map((c) => [round5(c[0]), round5(c[1])] as [number, number])),
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    legs: r.legs.map((l) => ({ distanceM: Math.round(l.distance), durationS: Math.round(l.duration) })),
    steps: steps.slice(0, MAX_COORDS),
  };
}

const pointsV = v.array(v.object({ lat: v.number(), lng: v.number() }));

function validPoints(points: { lat: number; lng: number }[]) {
  return (
    points.length >= 2 &&
    points.length <= 10 &&
    points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
  );
}

/**
 * A driving route with its turns, for /journey. Cached like `get` under its
 * own key, since the live position makes most starts new.
 */
export const navigate = action({
  args: { points: pointsV },
  handler: async (ctx, { points }): Promise<NavRoute | null> => {
    if (!validPoints(points)) return null;
    const key = `nav:${cacheKey("driving", points)}`;
    const cached = await ctx.runQuery(internal.routes.getCached, { key });
    if (cached?.legs && cached.steps) {
      return {
        coordinates: cached.coordinates as [number, number][],
        distanceM: cached.distanceM,
        durationS: cached.durationS,
        legs: cached.legs,
        steps: cached.steps,
      };
    }
    const path = points.map((p) => `${round5(p.lng)},${round5(p.lat)}`).join(";");
    for (const base of ENDPOINTS.driving) {
      try {
        const route = await fetchNavRoute(base, path);
        if (!route) continue;
        await ctx.runMutation(internal.routes.store, { key, profile: "driving", ...route });
        return route;
      } catch (err) {
        console.warn(`nav route via ${new URL(base).host} failed: ${String(err)}`);
      }
    }
    return null;
  },
});

export const get = action({
  args: {
    points: v.array(v.object({ lat: v.number(), lng: v.number() })),
    profile: profileV,
  },
  handler: async (ctx, { points, profile }): Promise<Route | null> => {
    if (points.length < 2 || points.length > 10) return null;
    const valid = points.every(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180,
    );
    if (!valid) return null;

    const key = cacheKey(profile, points);
    const cached = await ctx.runQuery(internal.routes.getCached, { key });
    if (cached) {
      return {
        coordinates: cached.coordinates as [number, number][],
        distanceM: cached.distanceM,
        durationS: cached.durationS,
      };
    }

    const path = points.map((p) => `${round5(p.lng)},${round5(p.lat)}`).join(";");
    for (const base of ENDPOINTS[profile]) {
      try {
        const route = await fetchRoute(base, path);
        if (!route) continue;
        await ctx.runMutation(internal.routes.store, { key, profile, ...route });
        return route;
      } catch (err) {
        console.warn(`route ${profile} via ${new URL(base).host} failed: ${String(err)}`);
      }
    }
    return null;
  },
});
