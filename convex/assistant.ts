import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { CATEGORIES, type Category } from "./lib/categories";
import { toCard, type PlaceCard } from "./places";

const MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TURNS = 12;
const MAX_CHARS = 2000;

const messageV = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
});

/** The facts the model may use: cities plus the best-known places in each. */
export const context = internalQuery({
  args: { citySlug: v.optional(v.string()), focusPlaceId: v.optional(v.id("places")) },
  handler: async (ctx, { citySlug, focusPlaceId }) => {
    const cities = (await ctx.db.query("cities").collect()).sort((a, b) => a.distanceKm - b.distanceKm);
    const places: Doc<"places">[] = [];
    for (const c of cities) {
      const take = c.slug === (citySlug ?? "sambhajinagar") ? 70 : 12;
      const rows = await ctx.db
        .query("places")
        .withIndex("by_city_group_score", (q) => q.eq("citySlug", c.slug).eq("group", "explore"))
        .order("desc")
        .take(take);
      places.push(...rows);
    }
    const focus = focusPlaceId ? await ctx.db.get(focusPlaceId) : null;
    return { cities, places, focus };
  },
});

function placeLine(p: Doc<"places">, cityName: string) {
  const label = CATEGORIES[p.category as Category]?.label ?? p.category;
  const bits = [`${p.name} | ${label} | ${cityName}`];
  if (p.openingHours) bits.push(`hours ${p.openingHours}`);
  if (p.cuisine) bits.push(`cuisine ${p.cuisine}`);
  if (p.summary) bits.push(p.summary.slice(0, 160));
  return `- ${bits.join(" | ")}`;
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Chat with the travel assistant. Grounded in our places; returns the places it mentions. */
export const chat = action({
  args: {
    messages: v.array(messageV),
    citySlug: v.optional(v.string()),
    focusPlaceId: v.optional(v.id("places")),
  },
  handler: async (ctx, { messages, citySlug, focusPlaceId }): Promise<{ reply: string; places: PlaceCard[] }> => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("ASSISTANT_NOT_CONFIGURED");
    const turns = messages
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (turns.length === 0 || turns[turns.length - 1].role !== "user") throw new Error("NO_QUESTION");

    const { cities, places, focus } = await ctx.runQuery(internal.assistant.context, { citySlug, focusPlaceId });
    const cityName = new Map(cities.map((c) => [c.slug, c.name]));

    const system = [
      "You are the City Cake travel assistant for Chhatrapati Sambhajinagar (formerly Aurangabad), Maharashtra, India, and its day trips.",
      "Help visitors decide what to see, where to eat, how to get around, and how to plan days.",
      "Rules:",
      "- Recommend only places from the PLACES list below, and write their names exactly as listed so the app can link them.",
      "- You may add widely known, stable facts (history, weekly closures, rough travel times, local food). If you are not sure, say so. Never invent places, prices or phone numbers.",
      "- Ajanta Caves are closed on Mondays and Ellora Caves on Tuesdays.",
      "- Keep answers short: a sentence or two, then a short list if useful. Plain words, no exclamation marks, no emoji.",
      "- Never state distances or walking times between places; you do not know them. Say they can tap a place for directions in the app.",
      "",
      "CITIES (distance from the city):",
      ...cities.map((c) => `- ${c.name}: ${c.distanceKm} km. ${c.blurb}`),
      "",
      "PLACES (name | category | town | details):",
      ...places.map((p) => placeLine(p, cityName.get(p.citySlug) ?? p.citySlug)),
      focus ? `\nThe user is looking at: ${focus.name} (${cityName.get(focus.citySlug) ?? focus.citySlug}).` : "",
    ].join("\n");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: "low",
        max_completion_tokens: 900,
        temperature: 0.4,
        messages: [{ role: "system", content: system }, ...turns],
      }),
    });
    if (!res.ok) {
      console.error("groq", res.status, (await res.text()).slice(0, 300));
      throw new Error("ASSISTANT_UNAVAILABLE");
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("ASSISTANT_UNAVAILABLE");

    // Link the places the reply mentions, longest names first, in order of appearance.
    const text = normalise(reply);
    const seen = new Set<string>();
    const mentioned = places
      .filter((p) => normalise(p.name).length >= 4)
      .sort((a, b) => b.name.length - a.name.length)
      .map((p) => ({ p, at: text.indexOf(normalise(p.name)) }))
      .filter(({ p, at }) => {
        if (at < 0 || seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      })
      .sort((a, b) => a.at - b.at)
      .slice(0, 6)
      .map(({ p }) => toCard(p));

    return { reply, places: mentioned };
  },
});
