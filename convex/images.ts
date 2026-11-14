import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { CURATED_IMAGES } from "./lib/curatedImages";
import { normaliseCommonsUrl } from "./lib/commons";
import type { Doc, Id } from "./_generated/dataModel";

const UA = "CityCake/0.1 (college project)";
const IMAGE_BONUS = 15;

/** Apply hand-picked photos from convex/lib/curatedImages.ts. Idempotent. */
export const applyCurated = internalMutation({
  args: {},
  handler: async (ctx) => {
    let applied = 0;
    let missing = 0;
    const byCity = new Map<string, Doc<"places">[]>();
    for (const c of CURATED_IMAGES) {
      if (!byCity.has(c.citySlug)) {
        byCity.set(
          c.citySlug,
          await ctx.db
            .query("places")
            .withIndex("by_city_group_score", (q) => q.eq("citySlug", c.citySlug).eq("group", "explore"))
            .collect(),
        );
      }
      const rows = byCity.get(c.citySlug)!.filter((p) => p.name === c.name);
      if (rows.length === 0) missing++;
      for (const p of rows) {
        if (p.image === c.image && p.imageKind === c.kind) continue;
        await ctx.db.patch(p._id, {
          image: c.image,
          imageKind: c.kind,
          score: p.image ? p.score : p.score + IMAGE_BONUS,
        });
        applied++;
      }
    }
    return { applied, missing };
  },
});

export const candidates = internalQuery({
  args: { citySlug: v.string(), limit: v.number() },
  handler: async (ctx, { citySlug, limit }) => {
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city_group_score", (q) => q.eq("citySlug", citySlug).eq("group", "explore"))
      .order("desc")
      .take(limit);
    return rows
      .filter((r) => !r.image)
      .map((r) => ({ _id: r._id, name: r.name, lat: r.lat, lng: r.lng }));
  },
});

export const setImage = internalMutation({
  args: { id: v.id("places"), image: v.string() },
  handler: async (ctx, { id, image }) => {
    const p = await ctx.db.get(id);
    if (!p || p.image) return;
    await ctx.db.patch(id, { image, imageKind: "exact", score: p.score + IMAGE_BONUS });
  },
});

const STOP = new Set(["the", "of", "and", "shri", "shree", "sri", "hazrat", "temple", "mandir", "masjid", "road", "chowk", "garden", "hotel", "restaurant"]);
function nameWords(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Find a Commons photo taken near each place whose file name mentions the place.
 * Only accepts a name match, so it never attaches an unrelated photo.
 */
export const backfillCommons = internalAction({
  args: { citySlug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { citySlug, limit }): Promise<{ checked: number; found: number }> => {
    const list: { _id: Id<"places">; name: string; lat: number; lng: number }[] = await ctx.runQuery(internal.images.candidates, { citySlug, limit: limit ?? 200 });
    let found = 0;
    for (const p of list) {
      const words = nameWords(p.name);
      if (words.length === 0) continue;
      const url =
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=geosearch" +
        `&ggscoord=${p.lat}|${p.lng}&ggsradius=400&ggsnamespace=6&ggslimit=20` +
        "&prop=imageinfo&iiprop=url|mime&iiurlwidth=960";
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          query?: { pages?: Record<string, { title: string; imageinfo?: { thumburl?: string; mime?: string }[] }> };
        };
        const pages = Object.values(data.query?.pages ?? {});
        const hit = pages.find((pg) => {
          const info = pg.imageinfo?.[0];
          if (!info?.thumburl || info.mime !== "image/jpeg") return false;
          const title = pg.title.toLowerCase();
          return words.every((w) => title.includes(w));
        });
        const thumb = hit?.imageinfo?.[0]?.thumburl;
        if (thumb) {
          const image = thumb.replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/").replace(/\?.*$/, "");
          await ctx.runMutation(internal.images.setImage, { id: p._id, image });
          found++;
        }
      } catch {
        // Skip this place; a later run can try again.
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log(`backfillCommons ${citySlug}: ${found} of ${list.length}`);
    return { checked: list.length, found };
  },
});

/** Rewrite Special:FilePath and thumb.wikimedia.org links to upload.wikimedia.org thumbnails. */
export const normaliseUrls = internalMutation({
  args: {},
  handler: async (ctx) => {
    let changed = 0;
    for (const city of await ctx.db.query("cities").collect()) {
      const rows = await ctx.db
        .query("places")
        .withIndex("by_city_group_score", (q) => q.eq("citySlug", city.slug).eq("group", "explore"))
        .collect();
      for (const p of rows) {
        if (!p.image) continue;
        const next = normaliseCommonsUrl(p.image);
        if (next !== p.image) {
          await ctx.db.patch(p._id, { image: next });
          changed++;
        }
      }
    }
    return { changed };
  },
});
