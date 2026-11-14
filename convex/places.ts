import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const groupV = v.union(v.literal("explore"), v.literal("facility"));

/** Slim shape for lists and map markers. */
export function toCard(p: Doc<"places">) {
  return {
    _id: p._id,
    name: p.name,
    category: p.category,
    group: p.group,
    citySlug: p.citySlug,
    lat: p.lat,
    lng: p.lng,
    image: p.image,
    imageKind: p.imageKind,
    summary: p.summary,
    address: p.address,
    openingHours: p.openingHours,
    score: p.score,
  };
}
export type PlaceCard = ReturnType<typeof toCard>;

/** All places of a city, optionally filtered by group and categories. Sorted by score. */
export const listByCity = query({
  args: {
    citySlug: v.string(),
    group: v.optional(groupV),
    categories: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { citySlug, group, categories, limit }) => {
    let rows: Doc<"places">[];
    if (categories && categories.length > 0) {
      const lists = await Promise.all(
        categories.map((category) =>
          ctx.db
            .query("places")
            .withIndex("by_city_category", (q) =>
              q.eq("citySlug", citySlug).eq("category", category),
            )
            .collect(),
        ),
      );
      rows = lists.flat();
    } else if (group) {
      rows = await ctx.db
        .query("places")
        .withIndex("by_city_group_score", (q) =>
          q.eq("citySlug", citySlug).eq("group", group),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("places")
        .withIndex("by_city", (q) => q.eq("citySlug", citySlug))
        .collect();
    }
    if (group) rows = rows.filter((r) => r.group === group);
    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, limit ?? 600).map(toCard);
  },
});

export const get = query({
  args: { id: v.id("places") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const getMany = query({
  args: { ids: v.array(v.id("places")) },
  handler: async (ctx, { ids }) => {
    const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return rows.filter((r): r is Doc<"places"> => r !== null).map(toCard);
  },
});

/** Full-text search on names, optionally within a city or group. */
export const search = query({
  args: {
    text: v.string(),
    citySlug: v.optional(v.string()),
    group: v.optional(groupV),
  },
  handler: async (ctx, { text, citySlug, group }) => {
    if (text.trim().length === 0) return [];
    const rows = await ctx.db
      .query("places")
      .withSearchIndex("search_name", (q) => {
        let s = q.search("name", text);
        if (citySlug) s = s.eq("citySlug", citySlug);
        if (group) s = s.eq("group", group);
        return s;
      })
      .take(20);
    return rows.map(toCard);
  },
});

/** Places near a point, nearest first. Scans the given city (or all cities). */
export const nearby = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    categories: v.optional(v.array(v.string())),
    citySlug: v.optional(v.string()),
    radiusM: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, categories, citySlug, radiusM, limit }) => {
    const rows = citySlug
      ? await ctx.db
          .query("places")
          .withIndex("by_city", (q) => q.eq("citySlug", citySlug))
          .collect()
      : await ctx.db.query("places").collect();
    const max = radiusM ?? 5000;
    return rows
      .filter((r) => !categories || categories.length === 0 || categories.includes(r.category))
      .map((r) => ({ ...toCard(r), distanceM: haversineM(lat, lng, r.lat, r.lng) }))
      .filter((r) => r.distanceM <= max)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, limit ?? 60);
  },
});

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
