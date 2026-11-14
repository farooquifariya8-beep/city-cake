import { action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { CITIES } from "./lib/cities";
import { cumulative, km, project, thin, type LngLat, type RouteStop } from "./lib/routeTrip";
import { nominatimSearch, type GeoResult } from "./geo";

const UA = "CityCake/0.1 (college project)";
// [query words, Photon osm_tag filter]
// Sights come from Wikipedia; Nominatim fills stays, food and fuel in a small
// box around each point. Nominatim allows one request a second, so these run
// one at a time with a pause, and results are cached per route.
const BOX_QUERIES = ["hotel", "restaurant", "fuel"];
const NOMINATIM_GAP_MS = 1100;

/** Notable places with Wikipedia articles near a point, with thumbnails. */
async function wikiNear(lat: number, lng: number): Promise<(GeoResult & { image?: string })[]> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&generator=geosearch" +
    `&ggscoord=${lat}|${lng}&ggsradius=10000&ggslimit=20&prop=coordinates|pageimages|pageprops&piprop=thumbnail&pithumbsize=500&ppprop=disambiguation`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { pageid: number; title: string; coordinates?: { lat: number; lon: number }[]; thumbnail?: { source: string } }> };
  };
  return Object.values(data.query?.pages ?? {})
    .filter((p) => {
      if (!p.coordinates?.[0]) return false;
      const t = p.title;
      if (/^(siege|battle|treaty|list|history) of/i.test(t)) return false;
      if (/\b(1[0-9]|20)[0-9]{2}\b|violence|riot|attack|massacre|election|bombing|accident|protest/i.test(t)) return false;
      if (/(district|taluka|tehsil|village|railway station|junction|constituency|river|airport|road|highway|college|school|university|company|bank)/i.test(t)) return false;
      // Single-word titles are almost always towns; keep them only when they name a sight.
      return /\s/.test(t.replace(/,.*$/, "")) || /(fort|temple|caves?|lake|palace|museum|garden|mandir|masjid|dargah|ghat|falls)/i.test(t);
    })
    .map((p) => ({
      osmId: `wiki/${p.pageid}`,
      name: p.title.replace(/,.*$/, ""),
      category: "attraction" as const,
      lat: p.coordinates![0].lat,
      lng: p.coordinates![0].lon,
      distanceKm: 0,
      image: p.thumbnail?.source,
    }));
}

const CORRIDOR_KM = 2.5;
const PER_CATEGORY = 40;
const CACHE_MS = 7 * 24 * 3600 * 1000;
// Categories worth stopping for on a road trip.
const WANTED = new Set(["heritage", "attraction", "museum", "religious", "park", "food", "cafe", "stay", "shopping", "fuel"]);

const endV = v.object({ name: v.string(), lat: v.number(), lng: v.number() });

export const cached = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("corridorCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return row && Date.now() - row._creationTime < CACHE_MS ? row.stops : null;
  },
});

export const store = internalMutation({
  args: { key: v.string(), stops: v.any() },
  handler: async (ctx, { key, stops }) => {
    const old = await ctx.db
      .query("corridorCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .collect();
    for (const o of old) await ctx.db.delete(o._id);
    await ctx.db.insert("corridorCache", { key, stops });
  },
});

/** Guide places in cities the route passes near. */
export const guideNear = internalQuery({
  args: { slugs: v.array(v.string()) },
  handler: async (ctx, { slugs }) => {
    const out: Doc<"places">[] = [];
    for (const slug of slugs) {
      out.push(
        ...(await ctx.db
          .query("places")
          .withIndex("by_city", (q) => q.eq("citySlug", slug))
          .collect()),
      );
    }
    return out.filter((p) => WANTED.has(p.category));
  },
});

/** Best places per category, spread along the route so one city can't fill the list. */
function spread(list: RouteStop[], totalKm: number): RouteStop[] {
  const bucketKm = Math.max(10, totalKm / 12);
  const perBucket = Math.max(2, Math.ceil(PER_CATEGORY / Math.max(1, totalKm / bucketKm)));
  const count = new Map<number, number>();
  const out: RouteStop[] = [];
  for (const s of [...list].sort((a, b) => b.score - a.score || a.offKm - b.offKm)) {
    const b = Math.floor(s.kmAlong / bucketKm);
    if ((count.get(b) ?? 0) >= perBucket) continue;
    count.set(b, (count.get(b) ?? 0) + 1);
    out.push(s);
    if (out.length >= PER_CATEGORY) break;
  }
  return out;
}

/**
 * The road route between two points and the places along it: sights, food,
 * stays, fuel. Combines the guide's data with OpenStreetMap. Cached for a week.
 */
export const alongRoute = action({
  args: { from: endV, to: endV },
  handler: async (
    ctx,
    { from, to },
  ): Promise<{
    route: { coordinates: LngLat[]; distanceM: number; durationS: number };
    stops: RouteStop[];
    partial: boolean;
  } | null> => {
    const route = await ctx.runAction(api.routes.get, {
      points: [
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng },
      ],
      profile: "driving",
    });
    if (!route) return null;
    const coords = route.coordinates as LngLat[];
    const fine = thin(coords, 400);
    const cum = cumulative(fine);
    const totalKm = cum[cum.length - 1];

    const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(3)).join(",");
    const hit = (await ctx.runQuery(internal.trips.cached, { key })) as RouteStop[] | null;
    if (hit) return { route: { coordinates: coords, distanceM: route.distanceM, durationS: route.durationS }, stops: hit, partial: false };

    const stops = new Map<string, RouteStop>();
    const add = (s: RouteStop) => {
      const prev = stops.get(s.key);
      if (!prev || s.score > prev.score) stops.set(s.key, s);
    };

    // 1. Places already in the guide, near the route.
    const slugs = CITIES.filter((c) => fine.some(([lng, lat]) => km(lat, lng, c.lat, c.lng) * 1000 < c.radiusM + 5000)).map(
      (c) => c.slug,
    );
    const guide: Doc<"places">[] = slugs.length ? await ctx.runQuery(internal.trips.guideNear, { slugs }) : [];
    const guideOsm = new Set<string>();
    for (const p of guide) {
      const pr = project(fine, cum, p.lat, p.lng);
      if (pr.offKm > CORRIDOR_KM) continue;
      guideOsm.add(p.osmId);
      add({
        key: p.osmId,
        placeId: p._id,
        osmId: p.osmId,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        kmAlong: Math.round(pr.kmAlong * 10) / 10,
        offKm: Math.round(pr.offKm * 10) / 10,
        image: p.image,
        score: p.score + 20,
      });
    }

    // 2. OpenStreetMap (Photon tag searches) and Wikipedia at points along the route.
    let partial = false;
    const samples = thin(coords, Math.min(8, Math.max(3, Math.round(totalKm / 35) + 1)));
    let failures = 0;
    const searchAt = async ([lng, lat]: LngLat) => {
      const centre = { lat, lng };
      const results: (GeoResult & { image?: string })[][] = [
        await wikiNear(lat, lng).catch(() => {
          failures++;
          return [];
        }),
      ];
      for (const q of BOX_QUERIES) {
        results.push(
          await nominatimSearch(q, centre, { boxKm: 3, limit: 12 }).catch(() => {
            failures++;
            return [];
          }),
        );
        await new Promise((r) => setTimeout(r, NOMINATIM_GAP_MS));
      }
      for (const r of results.flat()) {
        if (!WANTED.has(r.category) || guideOsm.has(r.osmId)) continue;
        const pr = project(fine, cum, r.lat, r.lng);
        if (pr.offKm > CORRIDOR_KM) continue;
        add({
          key: r.osmId,
          osmId: r.osmId.startsWith("wiki/") ? undefined : r.osmId,
          name: r.name,
          category: r.category,
          lat: r.lat,
          lng: r.lng,
          kmAlong: Math.round(pr.kmAlong * 10) / 10,
          offKm: Math.round(pr.offKm * 10) / 10,
          image: "image" in r ? (r.image as string | undefined) : undefined,
          score: ("image" in r && r.image ? 40 : 0) + (r.category === "heritage" || r.category === "attraction" ? 20 : 0),
        });
      }
    };
    for (let i = 0; i < samples.length; i++) {
      await searchAt(samples[i]);
    }
    partial = failures > samples.length * (BOX_QUERIES.length + 1) * 0.5;
    console.log(`alongRoute ${Math.round(totalKm)} km: ${stops.size} places, ${failures} failed lookups`);

    // Keep the best per category so long routes stay readable.
    const byCat = new Map<string, RouteStop[]>();
    for (const s of stops.values()) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);
    const out = [...byCat.values()]
      .flatMap((list) => spread(list, totalKm))
      .sort((a, b) => a.kmAlong - b.kmAlong);

    if (out.length >= 15) await ctx.runMutation(internal.trips.store, { key, stops: out });
    return { route: { coordinates: coords, distanceM: route.distanceM, durationS: route.durationS }, stops: out, partial };
  },
});


/** Maintenance: drop every cached corridor, e.g. after changing the filters. */
export const clearCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("corridorCache").collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});
