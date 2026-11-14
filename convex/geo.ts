import { action, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { CITIES } from "./lib/cities";
import { elementToPlace, type OsmElement } from "./lib/osm";
import { CATEGORIES, type Category } from "./lib/categories";
import { haversineM } from "./places";

// Photon (komoot) is a free OSM search with no key. India only.
const PHOTON = "https://photon.komoot.io/api/";
const INDIA_BBOX = "68.1,6.5,97.4,35.7";
const UA = "CityCake/0.1 (college project)";
const HOME = CITIES[0];

export type GeoResult = {
  osmId: string; // "node/123"
  name: string;
  category: Category;
  lat: number;
  lng: number;
  address?: string;
  placeId?: Id<"places">; // set when the place is already in our data
  distanceKm: number; // from the search centre
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: "N" | "W" | "R";
    osm_id: number;
    osm_key: string;
    osm_value: string;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

const OSM_TYPE = { N: "node", W: "way", R: "relation" } as const;

function toResult(f: PhotonFeature, centre: { lat: number; lng: number }): GeoResult | null {
  const p = f.properties;
  if (!p.name || (p.countrycode && p.countrycode !== "IN")) return null;
  const [lng, lat] = f.geometry.coordinates;
  const el: OsmElement = {
    type: OSM_TYPE[p.osm_type],
    id: p.osm_id,
    lat,
    lon: lng,
    tags: { [p.osm_key]: p.osm_value, name: p.name },
  };
  const row = elementToPlace(el, "india");
  const category: Category = (row?.category as Category | undefined) ?? "attraction";
  const address = [p.street && [p.housenumber, p.street].filter(Boolean).join(" "), p.locality ?? p.district, p.city ?? p.county, p.state]
    .filter(Boolean)
    .join(", ");
  return {
    osmId: `${OSM_TYPE[p.osm_type]}/${p.osm_id}`,
    name: p.name,
    category,
    lat,
    lng,
    address: address || undefined,
    distanceKm: Math.round(haversineM(centre.lat, centre.lng, lat, lng) / 100) / 10,
  };
}

export const idsForOsm = internalQuery({
  args: { osmIds: v.array(v.string()) },
  handler: async (ctx, { osmIds }) => {
    const out: Record<string, Id<"places">> = {};
    for (const osmId of osmIds) {
      const row = await ctx.db
        .query("places")
        .withIndex("by_osmId", (q) => q.eq("osmId", osmId))
        .first();
      if (row) out[osmId] = row._id;
    }
    return out;
  },
});

export async function photonSearch(
  text: string,
  centre: { lat: number; lng: number },
  limit = 10,
): Promise<GeoResult[]> {
  const url =
    `${PHOTON}?q=${encodeURIComponent(text)}&limit=${limit}&lang=en` +
    `&lat=${centre.lat}&lon=${centre.lng}&location_bias_scale=0.6&zoom=11&bbox=${INDIA_BBOX}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  return (data.features ?? [])
    .map((f) => toResult(f, centre))
    .filter((r): r is GeoResult => {
      if (!r || seen.has(r.osmId)) return false;
      seen.add(r.osmId);
      return true;
    });
}

/** Search any place in India. Results already in our data carry their placeId. */
export const search = action({
  args: { text: v.string(), lat: v.optional(v.number()), lng: v.optional(v.number()) },
  handler: async (ctx, { text, lat, lng }): Promise<GeoResult[]> => {
    const q = text.trim();
    if (q.length < 2) return [];
    const centre = { lat: lat ?? HOME.lat, lng: lng ?? HOME.lng };
    const results = await photonSearch(q, centre);
    const ids: Record<string, Id<"places">> = await ctx.runQuery(internal.geo.idsForOsm, {
      osmIds: results.map((r) => r.osmId),
    });
    return results.map((r) => (ids[r.osmId] ? { ...r, placeId: ids[r.osmId] } : r));
  },
});

/**
 * Add a search result to our places so it can be opened, saved and planned.
 * Idempotent by osmId. Places outside the region get citySlug "india".
 */
export const open = mutation({
  args: {
    osmId: v.string(),
    name: v.string(),
    category: v.string(),
    lat: v.number(),
    lng: v.number(),
    address: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<Id<"places">> => {
    const existing = await ctx.db
      .query("places")
      .withIndex("by_osmId", (q) => q.eq("osmId", a.osmId))
      .first();
    if (existing) return existing._id;
    const category = (a.category in CATEGORIES ? a.category : "attraction") as Category;
    const near = CITIES.map((c) => ({ c, d: haversineM(a.lat, a.lng, c.lat, c.lng) })).sort((x, y) => x.d - y.d)[0];
    const citySlug = near.d <= near.c.radiusM + 5000 ? near.c.slug : "india";
    return ctx.db.insert("places", {
      osmId: a.osmId,
      citySlug,
      name: a.name.slice(0, 120),
      category,
      group: CATEGORIES[category].group,
      lat: a.lat,
      lng: a.lng,
      address: a.address?.slice(0, 200),
      score: 0,
    });
  },
});

/** Town and state for a point, for "You're in ..." labels. */
export const reverse = action({
  args: { lat: v.number(), lng: v.number() },
  handler: async (_ctx, { lat, lng }): Promise<{ town: string; state?: string } | null> => {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en&limit=1`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    const town = p.city ?? p.locality ?? p.district ?? p.county ?? p.name;
    return town ? { town, state: p.state } : null;
  },
});
