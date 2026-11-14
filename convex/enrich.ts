// Enrichment: more places and photos for a city, without Overpass.
// Two sources, both reachable from Convex: Wikipedia geosearch (sights with
// a photo and a summary) and Nominatim category search (food, stays,
// facilities). Runs as a chain of scheduled actions, one grid point per step,
// so no action nears the 10 minute limit. Idempotent: upserts by osmId, or by
// "wiki/<pageid>" for places that exist only on Wikipedia.

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { CITIES, type CitySeed } from "./lib/cities";
import { CATEGORIES, type Category } from "./lib/categories";
import { scoreOf, IMAGE_BONUS } from "./lib/osm";
import { normalizeName } from "./lib/landmarks";
import { normaliseCommonsUrl } from "./lib/commons";
import { nominatimSearch } from "./geo";
import { haversineM } from "./places";

const UA = "CityCake/0.1 (college project)";
const NOMINATIM_GAP_MS = 1100;
const WIKI_GAP_MS = 2500;
const GRID_SPACING_KM = 5;
const NOMINATIM_BOX_KM = 2.5;
/** Score for a Wikipedia sight with a photo. See docs/data.md, "Enrichment". */
const WIKI_IMAGE_SCORE = 40;
const WIKI_SUMMARY_SCORE = 10;

/** Each phrase and the categories a hit must map to; anything else is dropped. */
const PHRASES: { q: string; want: Category[] }[] = [
  { q: "restaurant", want: ["food"] },
  { q: "cafe", want: ["cafe", "food"] },
  { q: "hotel", want: ["stay"] },
  { q: "temple", want: ["religious"] },
  { q: "museum", want: ["museum"] },
  { q: "park", want: ["park"] },
  { q: "mall", want: ["shopping"] },
];

function cityOf(slug: string): CitySeed {
  const c = CITIES.find((x) => x.slug === slug);
  if (!c) throw new Error(`Unknown city ${slug}`);
  return c;
}

/** A square lattice over the city's circle, GRID_SPACING_KM apart. */
export function gridFor(c: CitySeed): { lat: number; lng: number }[] {
  const n = Math.max(2, Math.ceil((2 * c.radiusM) / 1000 / GRID_SPACING_KM));
  const out: { lat: number; lng: number }[] = [];
  const kmLat = 111;
  const kmLng = 111 * Math.cos((c.lat * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dy = (i - (n - 1) / 2) * GRID_SPACING_KM;
      const dx = (j - (n - 1) / 2) * GRID_SPACING_KM;
      out.push({ lat: c.lat + dy / kmLat, lng: c.lng + dx / kmLng });
    }
  }
  return out;
}

// ---------- Name matching ----------

const STOP = new Set([
  "the", "of", "and", "shri", "shree", "sri", "hazrat", "ka", "ki", "ke",
  "aurangabad", "sambhajinagar", "chhatrapati", "india", "maharashtra",
  "temple", "mandir", "masjid", "mosque", "gate", "darwaza", "lake", "garden",
  "cave", "caves", "fort", "road", "chowk", "hotel", "restaurant", "museum",
]);
function words(n: string): string[] {
  return normalizeName(n).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
}
function squash(n: string) {
  return normalizeName(n).replace(/ /g, "");
}
/** Loose match: one name contains the other, or they share most real words. */
function similar(a: string, b: string): boolean {
  const sa = squash(a);
  const sb = squash(b);
  if (sa.length >= 4 && sb.length >= 4 && (sa.includes(sb) || sb.includes(sa))) return true;
  const wa = words(a);
  const wb = new Set(words(b));
  if (wa.length === 0 || wb.size === 0) return false;
  const common = wa.filter((w) => wb.has(w)).length;
  return common > 0 && common >= Math.min(wa.length, wb.size) * 0.5;
}
/** Strict match for far-apart copies of a big site: every real word of the shorter name. */
function strongSimilar(a: string, b: string): boolean {
  const sa = squash(a);
  const sb = squash(b);
  if (sa === sb) return true;
  const wa = words(a);
  const wb = words(b);
  const [short, long] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  return short.length > 0 && short.every((w) => long.has(w));
}

// ---------- Wikipedia ----------

type WikiPage = {
  pageid: number;
  title: string;
  coordinates?: { lat: number; lon: number }[];
  thumbnail?: { source: string };
  extract?: string;
  pageprops?: Record<string, string>;
};

export type WikiPlace = {
  osmId: string;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  image?: string;
  summary?: string;
  title: string;
};

/** Titles that are not sights. Extends the filters in trips.ts wikiNear. */
function isSight(title: string): boolean {
  const t = title;
  if (/^(siege|battle|treaty|list|history|timeline|geography|demographics) of/i.test(t)) return false;
  // Overview pages: "Gates in Aurangabad", "Neighborhoods of ...", "Diocese of ...", "Aurangabad division".
  if (/^(diocese|neighbou?rhoods?|gates|culture|tourism|economy|transport|people|architecture|climate|sport)\b|\b(division|region|metropolitan)\b/i.test(t)) return false;
  if (/\b(1[0-9]|20)[0-9]{2}\b|violence|riot|attack|massacre|election|bombing|accident|protest|earthquake|flood/i.test(t)) return false;
  if (/(district|taluka|tehsil|village|railway station|junction|constituency|river|airport|road|highway|college|school|university|company|bank)/i.test(t)) return false;
  if (/(hospital|medical|institute|academy|polytechnic|vidyalaya|limited|\bltd\b|industr|corporation|municipal|cantonment|\bmidc\b|\bward\b|lok sabha|vidhan sabha|assembly|newspaper|radio|television|\btv\b|stadium|cricket|club|court|police|jail|prison|office|bus stand|station|bridge|power|plant|factory|\bcidco\b|colony|sector|(^|\s)nagar$|\bpeth$|campus|hostel|centre for|center for|society|foundation|party|film|novel|album|song)/i.test(t)) return false;
  return /\s/.test(t.replace(/,.*$/, "").replace(/\s*\(.*\)$/, "")) || /(fort|temple|caves?|lake|palace|museum|garden|mandir|masjid|dargah|ghat|falls|maqbara|darwaza|gate)/i.test(t);
}

function wikiCategory(title: string): Category {
  const t = title.toLowerCase();
  if (/museum|gallery/.test(t)) return "museum";
  if (/fort|killa|qila|gate|darwaza|tomb|maqbara|caves?|ruins|mahal|minar|baradari|palace|stepwell|baoli|monument/.test(t)) return "heritage";
  if (/temple|mandir|masjid|mosque|dargah|church|gurudwara|gurdwara|jain|shrine|jyotirlinga|math\b|vihara|basadi/.test(t)) return "religious";
  if (/garden|bagh|lake|park|zoo|udyan|talav|tank|dam|reservoir|sanctuary/.test(t)) return "park";
  if (/mall|market|bazaar/.test(t)) return "shopping";
  return "attraction";
}

function cleanImage(src: string | undefined): string | undefined {
  if (!src) return undefined;
  // Locator maps, logos and diagrams are SVG or PNG; real photos are JPEG.
  if (!/\.jpe?g/i.test(src) || /(logo|map|locator|flag|seal|emblem)/i.test(src)) return undefined;
  return normaliseCommonsUrl(src);
}

function cleanSummary(s: string | undefined): string | undefined {
  const t = s?.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (!t || t.length < 30) return undefined;
  return t.length > 420 ? `${t.slice(0, 417).replace(/\s+\S*$/, "")}...` : t;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Geosearch around one point, following continuations so every page gets its extract. */
async function wikiGeosearch(lat: number, lng: number): Promise<WikiPage[]> {
  const base =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=geosearch" +
    `&ggscoord=${lat}|${lng}&ggsradius=10000&ggslimit=50` +
    "&prop=coordinates|pageimages|extracts|pageprops&colimit=max&piprop=thumbnail&pithumbsize=500&pilimit=max" +
    "&exintro=1&explaintext=1&exsentences=2&exlimit=max&ppprop=disambiguation";
  const pages = new Map<number, WikiPage>();
  let cont: Record<string, string> | undefined;
  for (let round = 0; round < 5; round++) {
    const extra = cont ? `&${new URLSearchParams(cont)}` : "";
    let res = await fetch(base + extra, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    // Back off on 429: wait 5, 10, then 20 seconds before giving up on this point.
    for (let wait = 5000; res.status === 429 && wait <= 20000; wait *= 2) {
      await sleep(wait);
      res = await fetch(base + extra, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    }
    if (!res.ok) throw new Error(`wikipedia ${res.status}`);
    const data = (await res.json()) as {
      continue?: Record<string, string>;
      query?: { pages?: WikiPage[] };
    };
    for (const p of data.query?.pages ?? []) {
      const prev = pages.get(p.pageid);
      pages.set(p.pageid, {
        ...prev,
        ...p,
        coordinates: p.coordinates ?? prev?.coordinates,
        thumbnail: p.thumbnail ?? prev?.thumbnail,
        extract: p.extract ?? prev?.extract,
        pageprops: p.pageprops ?? prev?.pageprops,
      });
    }
    // Only follow continuations within the same result set (extracts, coordinates).
    if (!data.continue || data.continue.ggsoffset) break;
    cont = data.continue;
    await sleep(300);
  }
  return [...pages.values()];
}

const PERSON = /\b(was|is) an? (\S+ ){0,3}(poet|writer|author|politician|actor|actress|singer|scholar|ruler|emperor|king|queen|sultan|nawab|cricketer|businessman|general|officer|musician|painter)\b/i;

function toWikiPlace(p: WikiPage): WikiPlace | null {
  if (p.pageprops && "disambiguation" in p.pageprops) return null;
  const c = p.coordinates?.[0];
  if (!c || !isSight(p.title)) return null;
  if (p.extract && PERSON.test(p.extract.slice(0, 200))) return null;
  // A title with no sight word needs a photo to show it is a place worth a card.
  if (wikiCategory(p.title) === "attraction" && !p.thumbnail) return null;
  const name = p.title.replace(/,.*$/, "").replace(/\s*\((aurangabad|maharashtra|india|ellora|daulatabad)\)$/i, "").trim();
  return {
    osmId: `wiki/${p.pageid}`,
    name,
    title: p.title,
    category: wikiCategory(p.title),
    lat: c.lat,
    lng: c.lon,
    image: cleanImage(p.thumbnail?.source),
    summary: cleanSummary(p.extract),
  };
}

// ---------- Mutations and queries ----------

const wikiPlaceV = v.object({
  osmId: v.string(),
  name: v.string(),
  title: v.string(),
  category: v.string(),
  lat: v.number(),
  lng: v.number(),
  image: v.optional(v.string()),
  summary: v.optional(v.string()),
});

function findMatch(rows: Doc<"places">[], name: string, lat: number, lng: number): Doc<"places"> | undefined {
  let best: { p: Doc<"places">; d: number } | undefined;
  for (const p of rows) {
    if (p.group !== "explore") continue;
    const d = haversineM(lat, lng, p.lat, p.lng);
    const ok = (d <= 150 && similar(name, p.name)) || (d <= 1500 && strongSimilar(name, p.name));
    if (ok && (!best || d < best.d)) best = { p, d };
  }
  return best?.p;
}

/** Insert Wikipedia sights, or add photo and summary to the place they duplicate. */
export const upsertWiki = internalMutation({
  args: { slug: v.string(), rows: v.array(wikiPlaceV) },
  handler: async (ctx, { slug, rows }) => {
    const city = await ctx.db
      .query("places")
      .withIndex("by_city", (q) => q.eq("citySlug", slug))
      .collect();
    let inserted = 0;
    let merged = 0;
    let updated = 0;
    let removed = 0;
    // Drop Wikipedia-only rows that the current title filter rejects, so a
    // tightened filter also cleans up earlier runs.
    for (const p of city) {
      if (!p.osmId.startsWith("wiki/")) continue;
      const title = p.wikipedia?.replace(/^en:/, "") ?? p.name;
      if (!isSight(title)) {
        await ctx.db.delete(p._id);
        removed++;
      }
    }
    for (const r of rows) {
      const category = r.category as Category;
      const existing = await ctx.db
        .query("places")
        .withIndex("by_osmId", (q) => q.eq("osmId", r.osmId))
        .first();
      const score =
        scoreOf(slug, category, {}, [r.name, r.title]) +
        (r.image ? WIKI_IMAGE_SCORE : 0) +
        (r.summary ? WIKI_SUMMARY_SCORE : 0);
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: r.name,
          category,
          lat: r.lat,
          lng: r.lng,
          image: existing.image ?? r.image,
          imageKind: existing.imageKind ?? (r.image ? "exact" : undefined),
          summary: r.summary ?? existing.summary,
          wikipedia: `en:${r.title}`,
          score,
        });
        updated++;
        continue;
      }
      const dup = findMatch(city.filter((p) => !p.osmId.startsWith("wiki/")), r.name, r.lat, r.lng);
      if (dup) {
        const patch: Partial<Doc<"places">> = {};
        if (!dup.image && r.image) {
          patch.image = r.image;
          patch.imageKind = "exact";
          patch.score = dup.score + IMAGE_BONUS;
        }
        if (!dup.summary && r.summary) patch.summary = r.summary;
        if (!dup.wikipedia) patch.wikipedia = `en:${r.title}`;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(dup._id, patch);
          merged++;
        }
        continue;
      }
      const id = await ctx.db.insert("places", {
        osmId: r.osmId,
        citySlug: slug,
        name: r.name.slice(0, 120),
        category,
        group: "explore",
        lat: r.lat,
        lng: r.lng,
        wikipedia: `en:${r.title}`,
        image: r.image,
        imageKind: r.image ? "exact" : undefined,
        summary: r.summary,
        score,
      });
      const doc = await ctx.db.get(id);
      if (doc) city.push(doc);
      inserted++;
    }
    return { inserted, merged, updated, removed };
  },
});

const nomRowV = v.object({
  osmId: v.string(),
  name: v.string(),
  category: v.string(),
  lat: v.number(),
  lng: v.number(),
  address: v.optional(v.string()),
});

/** Insert Nominatim hits that are new: unknown osmId and no same-named place within 80 m. */
export const insertNominatim = internalMutation({
  args: { slug: v.string(), rows: v.array(nomRowV) },
  handler: async (ctx, { slug, rows }) => {
    const city = await ctx.db
      .query("places")
      .withIndex("by_city", (q) => q.eq("citySlug", slug))
      .collect();
    let inserted = 0;
    let skipped = 0;
    for (const r of rows) {
      const category = r.category as Category;
      const existing = await ctx.db
        .query("places")
        .withIndex("by_osmId", (q) => q.eq("osmId", r.osmId))
        .first();
      const key = normalizeName(r.name);
      const near = city.some(
        (p) => p.category === category && normalizeName(p.name) === key && haversineM(r.lat, r.lng, p.lat, p.lng) <= 80,
      );
      if (existing || near) {
        skipped++;
        continue;
      }
      const id = await ctx.db.insert("places", {
        osmId: r.osmId,
        citySlug: slug,
        name: r.name.slice(0, 120),
        category,
        group: CATEGORIES[category].group,
        lat: r.lat,
        lng: r.lng,
        address: r.address?.slice(0, 200),
        score: scoreOf(slug, category, {}, [r.name]),
      });
      const doc = await ctx.db.get(id);
      if (doc) city.push(doc);
      inserted++;
    }
    return { inserted, skipped };
  },
});

async function countCity(ctx: { db: any }, slug: string) {
  const rows: Doc<"places">[] = await ctx.db
    .query("places")
    .withIndex("by_city", (q: any) => q.eq("citySlug", slug))
    .collect();
  const explore = rows.filter((r) => r.group === "explore");
  return {
    explore: explore.length,
    facility: rows.length - explore.length,
    withImage: explore.filter((r) => !!r.image).length,
    wikiOnly: rows.filter((r) => r.osmId.startsWith("wiki/")).length,
  };
}

/** Set the city's counts from its rows. */
export const finish = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const c = await countCity(ctx, slug);
    const city = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (city) await ctx.db.patch(city._id, { placeCount: c.explore, facilityCount: c.facility });
    console.log(`enrich ${slug} done: ${JSON.stringify(c)}`);
    return c;
  },
});

/** Counts for a city: explore, facility, explore with a photo, Wikipedia-only rows. */
export const stats = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => countCity(ctx, slug),
});

/** Top explore places by score, for checking the ranking. */
export const top = internalQuery({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { slug, limit }) => {
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city_group_score", (q) => q.eq("citySlug", slug).eq("group", "explore"))
      .order("desc")
      .take(limit ?? 15);
    return rows.map((r) => ({ name: r.name, category: r.category, score: r.score, image: !!r.image, osmId: r.osmId }));
  },
});

/** Rows created after a time, for spot checks. */
export const createdSince = internalQuery({
  args: { slug: v.string(), since: v.number() },
  handler: async (ctx, { slug, since }) => {
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city", (q) => q.eq("citySlug", slug))
      .collect();
    return rows
      .filter((r) => r._creationTime >= since)
      .map((r) => ({ name: r.name, category: r.category, group: r.group, osmId: r.osmId, lat: r.lat, lng: r.lng, image: !!r.image }));
  },
});

// ---------- The chain ----------

/** Fetch and filter Wikipedia sights over the whole grid. Writes only when write is true. */
async function collectWiki(c: CitySeed): Promise<{ places: WikiPlace[]; failures: number; raw: number }> {
  const byId = new Map<string, WikiPlace>();
  let failures = 0;
  let raw = 0;
  for (const pt of gridFor(c)) {
    try {
      const pages = await wikiGeosearch(pt.lat, pt.lng);
      raw += pages.length;
      for (const p of pages) {
        const w = toWikiPlace(p);
        if (!w || haversineM(c.lat, c.lng, w.lat, w.lng) > c.radiusM) continue;
        byId.set(w.osmId, w);
      }
    } catch (e) {
      failures++;
      console.log(`wiki ${c.slug} point failed: ${e}`);
    }
    await sleep(WIKI_GAP_MS);
  }
  return { places: [...byId.values()], failures, raw };
}

/** Preview the Wikipedia step without writing: titles kept and their categories. */
export const previewWiki = internalAction({
  args: { slug: v.string() },
  handler: async (_ctx, { slug }) => {
    const { places, failures, raw } = await collectWiki(cityOf(slug));
    return {
      raw,
      failures,
      kept: places.length,
      places: places.map((p) => `${p.category} | ${p.title} | ${p.image ? "img" : "-"}`).sort(),
    };
  },
});

export const wikiStep = internalAction({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const c = cityOf(slug);
    const { places, failures } = await collectWiki(c);
    const r: { inserted: number; merged: number; updated: number; removed: number } = await ctx.runMutation(internal.enrich.upsertWiki, {
      slug,
      rows: places,
    });
    console.log(`enrich ${slug} wiki: ${places.length} sights, ${JSON.stringify(r)}, ${failures} failed points`);
    await ctx.scheduler.runAfter(0, internal.enrich.nominatimStep, { slug, i: 0 });
  },
});

/** One grid point: every phrase in a small box, one Nominatim request at a time. */
export const nominatimStep = internalAction({
  args: { slug: v.string(), i: v.number() },
  handler: async (ctx, { slug, i }) => {
    const c = cityOf(slug);
    const grid = gridFor(c);
    if (i >= grid.length) {
      await ctx.runMutation(internal.enrich.finish, { slug });
      return;
    }
    const pt = grid[i];
    const rows: { osmId: string; name: string; category: string; lat: number; lng: number; address?: string }[] = [];
    let failures = 0;
    for (const ph of PHRASES) {
      try {
        const hits = await nominatimSearch(ph.q, pt, { boxKm: NOMINATIM_BOX_KM, limit: 40 });
        for (const h of hits) {
          if (!ph.want.includes(h.category)) continue;
          if (haversineM(c.lat, c.lng, h.lat, h.lng) > c.radiusM) continue;
          rows.push({ osmId: h.osmId, name: h.name, category: h.category, lat: h.lat, lng: h.lng, address: h.address });
        }
      } catch (e) {
        failures++;
        console.log(`nominatim ${slug} ${i} "${ph.q}" failed: ${e}`);
        await sleep(5000); // back off on 429 or a timeout
      }
      await sleep(NOMINATIM_GAP_MS);
    }
    const unique = [...new Map(rows.map((r) => [r.osmId, r])).values()];
    const r: { inserted: number; skipped: number } = await ctx.runMutation(internal.enrich.insertNominatim, {
      slug,
      rows: unique,
    });
    console.log(`enrich ${slug} nominatim ${i + 1}/${grid.length}: ${unique.length} hits, ${JSON.stringify(r)}, ${failures} failed`);
    await ctx.scheduler.runAfter(0, internal.enrich.nominatimStep, { slug, i: i + 1 });
  },
});

/** Entry point: `bunx convex run enrich:city '{"slug":"sambhajinagar"}'`. */
export const city = internalAction({
  args: { slug: v.string(), skipWiki: v.optional(v.boolean()) },
  handler: async (ctx, { slug, skipWiki }) => {
    const c = cityOf(slug);
    if (skipWiki) await ctx.scheduler.runAfter(0, internal.enrich.nominatimStep, { slug, i: 0 });
    else await ctx.scheduler.runAfter(0, internal.enrich.wikiStep, { slug });
    return { slug, gridPoints: gridFor(c).length, startedAt: Date.now() };
  },
});
