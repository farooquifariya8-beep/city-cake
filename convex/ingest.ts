// OSM and Wikipedia ingest. Only these actions call Overpass and Wikipedia.
// Every write upserts by osmId, so a rerun converges to the same rows.
// Policies: docs/data.md.

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CITIES } from "./lib/cities";
import { isLandmark } from "./lib/landmarks";
import { buildOverpassQuery, elementsToPlaces, IMAGE_BONUS, type OsmElement } from "./lib/osm";
import { commonsThumb } from "./lib/commons";

const USER_AGENT = "CityCake/0.1 (college project)";
// overpass-api.de is the documented endpoint, but it refuses connections from
// Convex's cloud egress (TLS fails in ~100 ms). The VK mirror serves the same
// replicated data and answers from Convex, so it is the fallback.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 240000;
const BATCH = 200;
const OVERPASS_PAUSE_MS = 2000;
const WIKI_PAUSE_MS = 1000;
const RETRY_WAIT_MS = 15000;
const SUMMARY_MAX = 400;
const PREWARM_TRIES = 5;
const PREWARM_RETRY_MS = 60000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const placeRowV = v.object({
  osmId: v.string(),
  citySlug: v.string(),
  name: v.string(),
  category: v.string(),
  group: v.union(v.literal("explore"), v.literal("facility")),
  lat: v.number(),
  lng: v.number(),
  address: v.optional(v.string()),
  openingHours: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  cuisine: v.optional(v.string()),
  description: v.optional(v.string()),
  wikipedia: v.optional(v.string()),
  wikidata: v.optional(v.string()),
  score: v.number(),
  tags: v.optional(v.record(v.string(), v.string())),
});

// ---------- Mutations and queries ----------

/** Upsert a batch by osmId. Keeps image and summary from enrichment, and its score bonus. */
export const upsertPlaces = internalMutation({
  args: { rows: v.array(placeRowV) },
  handler: async (ctx, { rows }) => {
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const existing = await ctx.db
        .query("places")
        .withIndex("by_osmId", (q) => q.eq("osmId", row.osmId))
        .unique();
      if (existing) {
        const score = row.score + (existing.image ? IMAGE_BONUS : 0);
        await ctx.db.replace(existing._id, {
          ...row,
          score,
          image: existing.image,
          summary: existing.summary,
        });
        updated++;
      } else {
        await ctx.db.insert("places", row);
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

/** Upsert the city row from CITIES with fresh counts. */
export const upsertCity = internalMutation({
  args: {
    slug: v.string(),
    placeCount: v.number(),
    facilityCount: v.number(),
    fetchedAt: v.number(),
  },
  handler: async (ctx, { slug, placeCount, facilityCount, fetchedAt }) => {
    const seed = CITIES.find((c) => c.slug === slug);
    if (!seed) throw new Error(`Unknown city ${slug}`);
    const doc = { ...seed, placeCount, facilityCount, fetchedAt };
    const existing = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("cities", doc);
  },
});

/**
 * Remove a city's rows whose osmId is no longer in the fresh set (deleted in
 * OSM or merged by dedupe). Only runs when fetchCity is called with prune.
 */
export const pruneCity = internalMutation({
  args: { citySlug: v.string(), keep: v.array(v.string()) },
  handler: async (ctx, { citySlug, keep }) => {
    const keepSet = new Set(keep);
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city", (q) => q.eq("citySlug", citySlug))
      .collect();
    let removed = 0;
    for (const r of rows) {
      if (!keepSet.has(r.osmId)) {
        await ctx.db.delete(r._id);
        removed++;
      }
    }
    return removed;
  },
});

/** Top explore places with a wikipedia or wikidata tag, by score. */
export const enrichCandidates = internalQuery({
  args: { citySlug: v.string(), limit: v.number() },
  handler: async (ctx, { citySlug, limit }) => {
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city_group_score", (q) =>
        q.eq("citySlug", citySlug).eq("group", "explore"),
      )
      .order("desc")
      .collect();
    // Tagged places first; hand-picked landmarks without tags try their name
    // as an English Wikipedia title.
    return rows
      .filter((r) => r.wikipedia || r.wikidata || isLandmark(citySlug, [r.name]))
      .slice(0, limit)
      .map((r) => ({
        _id: r._id,
        name: r.name,
        wikipedia: r.wikipedia ?? (r.wikidata ? undefined : `en:${r.name}`),
        wikidata: r.wikidata,
        byName: !r.wikipedia && !r.wikidata,
        hasImage: !!r.image,
        hasSummary: !!r.summary,
      }));
  },
});

export const setEnrichment = internalMutation({
  args: {
    id: v.id("places"),
    image: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, { id, image, summary }) => {
    const p = await ctx.db.get(id);
    if (!p) return;
    const patch: { image?: string; summary?: string; score?: number } = {};
    if (image && !p.image) {
      patch.image = image;
      patch.score = p.score + IMAGE_BONUS;
    } else if (image) {
      patch.image = image;
    }
    if (summary) patch.summary = summary;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

// ---------- External calls ----------

/** fetch with our User-Agent; on 429 or 504 wait and retry once. */
async function politeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const withUa: RequestInit = {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
  };
  let res = await fetch(url, withUa);
  if (res.status === 429 || res.status === 504) {
    console.warn(`${res.status} from ${new URL(url).host}, retrying in ${RETRY_WAIT_MS} ms`);
    await sleep(RETRY_WAIT_MS);
    res = await fetch(url, withUa);
  }
  return res;
}

type FetchSummary = {
  slug: string;
  elements: number;
  placeCount: number;
  facilityCount: number;
  inserted: number;
  updated: number;
  removed: number;
};

type EnrichSummary = {
  slug: string;
  candidates: number;
  images: number;
  summaries: number;
  skipped: number;
};

/** POST to each Overpass endpoint in turn until one answers with JSON. */
export async function overpass(query: string, timeoutMs = OVERPASS_TIMEOUT_MS): Promise<{ elements?: OsmElement[] }> {
  const errors: string[] = [];
  for (const url of OVERPASS_URLS) {
    try {
      const res = await politeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        errors.push(`${new URL(url).host} ${res.status}: ${(await res.text()).slice(0, 120)}`);
        continue;
      }
      return (await res.json()) as { elements?: OsmElement[] };
    } catch (err) {
      errors.push(`${new URL(url).host}: ${String(err).slice(0, 120)}`);
    }
  }
  throw new Error(`Overpass failed: ${errors.join(" | ")}`);
}

async function fetchCityImpl(
  ctx: ActionCtx,
  slug: string,
  prune: boolean,
): Promise<FetchSummary> {
  const city = CITIES.find((c) => c.slug === slug);
  if (!city) throw new Error(`Unknown city ${slug}`);

  const query = buildOverpassQuery(city.lat, city.lng, city.radiusM);
  const json = await overpass(query);
  const elements = json.elements ?? [];
  const rows = elementsToPlaces(elements, slug);

  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const r: { inserted: number; updated: number } = await ctx.runMutation(internal.ingest.upsertPlaces, {
      rows: rows.slice(i, i + BATCH),
    });
    inserted += r.inserted;
    updated += r.updated;
  }
  const removed: number = prune
    ? await ctx.runMutation(internal.ingest.pruneCity, {
        citySlug: slug,
        keep: rows.map((r) => r.osmId),
      })
    : 0;

  const placeCount = rows.filter((r) => r.group === "explore").length;
  const facilityCount = rows.length - placeCount;
  await ctx.runMutation(internal.ingest.upsertCity, {
    slug,
    placeCount,
    facilityCount,
    fetchedAt: Date.now(),
  });
  const summary: FetchSummary = {
    slug,
    elements: elements.length,
    placeCount,
    facilityCount,
    inserted,
    updated,
    removed,
  };
  console.log(`fetchCity ${JSON.stringify(summary)}`);
  return summary;
}

type WikiSummary = {
  type?: string; // "standard", "disambiguation", ...
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  wikibase_item?: string;
};

async function wikiSummary(lang: string, title: string): Promise<WikiSummary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}`;
  const res = await politeFetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return (await res.json()) as WikiSummary;
}

type Entity = {
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
};

async function wikidataEntity(q: string): Promise<{ enTitle?: string; p18?: string } | null> {
  if (!/^Q\d+$/.test(q)) return null;
  const res = await politeFetch(`https://www.wikidata.org/wiki/Special:EntityData/${q}.json`);
  if (!res.ok) return null;
  const json = (await res.json()) as { entities?: Record<string, Entity> };
  const entity = json.entities ? Object.values(json.entities)[0] : undefined;
  if (!entity) return null;
  const p18 = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return {
    enTitle: entity.sitelinks?.enwiki?.title,
    p18: typeof p18 === "string" ? p18 : undefined,
  };
}

function commonsImage(file: string): string {
  return commonsThumb(file);
}

function trimSummary(text: string | undefined): string | undefined {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (t.length <= SUMMARY_MAX) return t;
  const cut = t.slice(0, SUMMARY_MAX);
  const lastStop = cut.lastIndexOf(". ");
  if (lastStop > SUMMARY_MAX * 0.5) return cut.slice(0, lastStop + 1);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

/** One place: Wikipedia summary in English, falling back through Wikidata. ≤3 requests. */
async function enrichOne(p: {
  wikipedia?: string;
  wikidata?: string;
  byName: boolean;
}): Promise<{ image?: string; summary?: string; requests: number }> {
  let requests = 0;
  const pace = async () => {
    if (requests > 0) await sleep(WIKI_PAUSE_MS);
    requests++;
  };

  let lang: string | undefined;
  let title: string | undefined;
  if (p.wikipedia) {
    const m = /^([a-z-]{2,12}):(.+)$/.exec(p.wikipedia);
    if (m) [lang, title] = [m[1], m[2]];
    else [lang, title] = ["en", p.wikipedia];
  }

  let p18: string | undefined;
  if (lang !== "en" && p.wikidata) {
    await pace();
    const e = await wikidataEntity(p.wikidata);
    p18 = e?.p18;
    if (e?.enTitle) [lang, title] = ["en", e.enTitle];
  }

  let image: string | undefined;
  let summary: string | undefined;
  if (lang && title) {
    await pace();
    let s = await wikiSummary(lang, title);
    // A guessed title must land on a real article, not a disambiguation page.
    if (p.byName && s?.type !== "standard") s = null;
    image = s?.thumbnail?.source ?? s?.originalimage?.source;
    if (lang === "en") summary = trimSummary(s?.extract);
  }
  if (!image && !p18 && p.wikidata && lang === "en" && requests < 3) {
    await pace();
    p18 = (await wikidataEntity(p.wikidata))?.p18;
  }
  if (!image && p18) image = commonsImage(p18);
  return { image, summary, requests };
}

async function enrichCityImpl(
  ctx: ActionCtx,
  slug: string,
  limit: number,
): Promise<EnrichSummary> {
  const candidates: {
    _id: Id<"places">;
    name: string;
    wikipedia?: string;
    wikidata?: string;
    byName: boolean;
    hasImage: boolean;
    hasSummary: boolean;
  }[] = await ctx.runQuery(internal.ingest.enrichCandidates, {
    citySlug: slug,
    limit,
  });
  let images = 0;
  let summaries = 0;
  let skipped = 0;
  let first = true;
  for (const c of candidates) {
    if (c.hasImage && c.hasSummary) {
      skipped++;
      continue;
    }
    if (!first) await sleep(WIKI_PAUSE_MS);
    first = false;
    try {
      const r = await enrichOne(c);
      if (r.image || r.summary) {
        await ctx.runMutation(internal.ingest.setEnrichment, {
          id: c._id,
          image: r.image,
          summary: r.summary,
        });
      }
      if (r.image) images++;
      if (r.summary) summaries++;
    } catch (err) {
      console.warn(`enrich ${c.name} failed: ${String(err)}`);
    }
  }
  const out: EnrichSummary = { slug, candidates: candidates.length, images, summaries, skipped };
  console.log(`enrichCity ${JSON.stringify(out)}`);
  return out;
}

// ---------- Actions ----------

export const fetchCity = internalAction({
  args: { slug: v.string(), prune: v.optional(v.boolean()) },
  handler: async (ctx, { slug, prune }): Promise<FetchSummary> => fetchCityImpl(ctx, slug, prune ?? false),
});

export const enrichCity = internalAction({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { slug, limit }): Promise<EnrichSummary> => enrichCityImpl(ctx, slug, limit ?? 40),
});

/**
 * One city of the prewarm chain: fetch, enrich, then schedule the next city
 * after a 2 s pause. Each link runs in its own action, so the chain never hits
 * the 10 minute action limit however many cities there are. A failed fetch
 * (Overpass busy) is retried up to 5 times, a minute apart, then skipped.
 */
export const prewarmStep = internalAction({
  args: {
    index: v.number(),
    attempt: v.optional(v.number()),
    prune: v.optional(v.boolean()),
  },
  handler: async (ctx, { index, attempt, prune }): Promise<void> => {
    const city = CITIES[index];
    if (!city) {
      console.log("prewarm done");
      return;
    }
    const tries = attempt ?? 1;
    let fetched: FetchSummary;
    try {
      fetched = await fetchCityImpl(ctx, city.slug, prune ?? false);
    } catch (err) {
      console.error(`prewarm ${city.slug} fetch failed (try ${tries}): ${String(err)}`);
      if (tries < PREWARM_TRIES) {
        await ctx.scheduler.runAfter(PREWARM_RETRY_MS, internal.ingest.prewarmStep, {
          index,
          attempt: tries + 1,
          prune,
        });
        return;
      }
      await ctx.scheduler.runAfter(OVERPASS_PAUSE_MS, internal.ingest.prewarmStep, {
        index: index + 1,
        prune,
      });
      return;
    }
    const enriched = await enrichCityImpl(ctx, city.slug, 40);
    console.log(
      `prewarm ${city.slug}: ${fetched.placeCount} explore, ${fetched.facilityCount} facilities, ${enriched.images} new images`,
    );
    await ctx.scheduler.runAfter(OVERPASS_PAUSE_MS, internal.ingest.prewarmStep, {
      index: index + 1,
      prune,
    });
  },
});

/** Fetch and enrich every city in CITIES, one after another. Returns once the chain is scheduled. */
export const prewarmAll = internalAction({
  args: { prune: v.optional(v.boolean()) },
  handler: async (ctx, { prune }): Promise<{ scheduled: string[] }> => {
    await ctx.scheduler.runAfter(0, internal.ingest.prewarmStep, { index: 0, prune });
    console.log(`prewarm scheduled for ${CITIES.length} cities`);
    return { scheduled: CITIES.map((c) => c.slug) };
  },
});

