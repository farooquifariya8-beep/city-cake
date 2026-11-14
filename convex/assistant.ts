import { action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "./lib/categories";
import { CITIES } from "./lib/cities";
import { haversineM, toCard, type PlaceCard } from "./places";
import { photonSearch } from "./geo";

// Groq free tier: 8,000 tokens a minute. Keep the prompt small and let the model
// fetch facts through tools instead of sending the whole place list.
const MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TURNS = 10;
const MAX_CHARS = 1500;
const MAX_TOOL_ROUNDS = 4;

const messageV = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
});

type Msg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

const CATEGORY_LIST = CATEGORY_KEYS.join(", ");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "top_places",
      description: "Best-known places in a town of this guide, optionally one category. Use for 'what should I see' questions.",
      parameters: {
        type: "object",
        properties: {
          town: { type: "string", description: `One of: ${CITIES.map((c) => c.slug).join(", ")}` },
          category: { type: "string", description: `Optional category: ${CATEGORY_LIST}` },
          limit: { type: "integer", description: "1 to 12, default 8" },
        },
        required: ["town"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_place",
      description: "Find a place by name anywhere in India. Checks this guide first, then OpenStreetMap.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "nearby",
      description: "Places of given categories near a place (by name), nearest first, with distances.",
      parameters: {
        type: "object",
        properties: {
          place: { type: "string", description: "Name of the place to search around" },
          categories: { type: "array", items: { type: "string" }, description: `From: ${CATEGORY_LIST}` },
          radius_km: { type: "number", description: "Default 2" },
        },
        required: ["place", "categories"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "travel_time",
      description: "Road distance and time between two places or towns. 'from' defaults to Chhatrapati Sambhajinagar city centre.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          mode: { type: "string", enum: ["driving", "foot"] },
        },
        required: ["to"],
      },
    },
  },
] as const;

const SYSTEM = [
  "You are the City Cake travel assistant for Chhatrapati Sambhajinagar (formerly Aurangabad), Maharashtra, India, and its day trips: Ellora (29 km), Daulatabad (16 km), Ajanta (104 km), Paithan (56 km), Jalna (62 km), Lonar (160 km).",
  "Use the tools to get facts: places, what is nearby, and real travel times. Never invent places, distances, times, prices or phone numbers. If a tool returns nothing, say so.",
  "Known facts: Ajanta Caves are closed on Mondays. Ellora Caves are closed on Tuesdays. Both open about 9:00 to 17:30. Bibi Ka Maqbara is open daily, sunrise to 22:00.",
  "Write place names exactly as the tools return them. Keep answers short: one or two sentences, then a short list if useful. Plain words, no exclamation marks, no emoji, no tables.",
].join("\n");

export const top = internalQuery({
  args: { citySlug: v.string(), category: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, { citySlug, category, limit }) => {
    const rows = category
      ? await ctx.db
          .query("places")
          .withIndex("by_city_category", (q) => q.eq("citySlug", citySlug).eq("category", category))
          .collect()
      : await ctx.db
          .query("places")
          .withIndex("by_city_group_score", (q) => q.eq("citySlug", citySlug).eq("group", "explore"))
          .order("desc")
          .take(limit);
    return rows.sort((a, b) => b.score - a.score).slice(0, limit);
  },
});

export const findInGuide = internalQuery({
  args: { text: v.string() },
  handler: async (ctx, { text }) =>
    ctx.db
      .query("places")
      .withSearchIndex("search_name", (q) => q.search("name", text))
      .take(5),
});

export const near = internalQuery({
  args: { lat: v.number(), lng: v.number(), categories: v.array(v.string()), radiusM: v.number() },
  handler: async (ctx, { lat, lng, categories, radiusM }) => {
    const lists = await Promise.all(
      CITIES.map((c) =>
        haversineM(lat, lng, c.lat, c.lng) > c.radiusM + radiusM + 2000
          ? Promise.resolve([] as Doc<"places">[])
          : Promise.all(
              categories.map((cat) =>
                ctx.db
                  .query("places")
                  .withIndex("by_city_category", (q) => q.eq("citySlug", c.slug).eq("category", cat))
                  .collect(),
              ),
            ).then((x) => x.flat()),
      ),
    );
    return lists
      .flat()
      .map((p) => ({ p, d: haversineM(lat, lng, p.lat, p.lng) }))
      .filter((x) => x.d <= radiusM)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  },
});

type Point = { name: string; lat: number; lng: number; doc?: Doc<"places"> };

export const chat = action({
  args: {
    messages: v.array(messageV),
    citySlug: v.optional(v.string()),
    focusPlaceId: v.optional(v.id("places")),
  },
  handler: async (ctx, { messages, citySlug, focusPlaceId }): Promise<{ reply: string; places: PlaceCard[] }> => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("ASSISTANT_NOT_CONFIGURED");
    const turns = messages.slice(-MAX_TURNS).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (turns.length === 0 || turns[turns.length - 1].role !== "user") throw new Error("NO_QUESTION");

    const seen = new Map<Id<"places">, Doc<"places">>();
    const remember = (docs: Doc<"places">[]) => docs.forEach((d) => seen.set(d._id, d));

    const focus = focusPlaceId ? await ctx.runQuery(api.places.get, { id: focusPlaceId }) : null;
    if (focus) remember([focus]);

    async function resolve(name: string | undefined): Promise<Point | null> {
      if (!name) return { name: CITIES[0].name, lat: CITIES[0].lat, lng: CITIES[0].lng };
      const n = name.toLowerCase();
      const town = CITIES.find((c) => n.includes(c.slug) || c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
      const inGuide: Doc<"places">[] = await ctx.runQuery(internal.assistant.findInGuide, { text: name });
      if (inGuide[0] && (!town || inGuide[0].name.toLowerCase().includes(n))) {
        remember(inGuide.slice(0, 1));
        return { name: inGuide[0].name, lat: inGuide[0].lat, lng: inGuide[0].lng, doc: inGuide[0] };
      }
      if (town) return { name: town.name, lat: town.lat, lng: town.lng };
      const geo = await photonSearch(name, CITIES[0], 1);
      return geo[0] ? { name: geo[0].name, lat: geo[0].lat, lng: geo[0].lng } : null;
    }

    const brief = (p: Doc<"places">) => ({
      name: p.name,
      category: CATEGORIES[p.category as Category]?.label ?? p.category,
      town: CITIES.find((c) => c.slug === p.citySlug)?.name ?? p.citySlug,
      hours: p.openingHours,
      cuisine: p.cuisine,
      about: p.summary?.slice(0, 180),
    });

    async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      switch (name) {
        case "top_places": {
          const town = CITIES.find((c) => c.slug === args.town || c.name.toLowerCase() === String(args.town).toLowerCase()) ?? CITIES[0];
          const category = typeof args.category === "string" && args.category in CATEGORIES ? args.category : undefined;
          const limit = Math.min(12, Math.max(1, Number(args.limit) || 8));
          const rows: Doc<"places">[] = await ctx.runQuery(internal.assistant.top, { citySlug: town.slug, category, limit });
          remember(rows);
          return rows.map(brief);
        }
        case "find_place": {
          const q = String(args.query ?? "");
          const inGuide: Doc<"places">[] = await ctx.runQuery(internal.assistant.findInGuide, { text: q });
          remember(inGuide);
          const outside = inGuide.length >= 3 ? [] : await photonSearch(q, CITIES[0], 4);
          return {
            in_guide: inGuide.map(brief),
            elsewhere_in_india: outside.map((r) => ({ name: r.name, address: r.address, km_from_city: r.distanceKm })),
          };
        }
        case "nearby": {
          const at = await resolve(String(args.place ?? ""));
          if (!at) return { error: "place not found" };
          const cats = (Array.isArray(args.categories) ? args.categories : []).map(String).filter((c) => c in CATEGORIES);
          const radiusM = Math.min(10, Math.max(0.3, Number(args.radius_km) || 2)) * 1000;
          const rows: { p: Doc<"places">; d: number }[] = await ctx.runQuery(internal.assistant.near, {
            lat: at.lat,
            lng: at.lng,
            categories: cats.length ? cats : ["food"],
            radiusM,
          });
          remember(rows.map((r) => r.p));
          return { around: at.name, results: rows.map((r) => ({ ...brief(r.p), metres: Math.round(r.d / 10) * 10 })) };
        }
        case "travel_time": {
          const [from, to] = await Promise.all([resolve(args.from as string | undefined), resolve(String(args.to ?? ""))]);
          if (!from || !to) return { error: "place not found" };
          const profile = args.mode === "foot" ? "foot" : "driving";
          const route = await ctx.runAction(api.routes.get, {
            points: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }],
            profile,
          });
          if (!route) return { error: "no route found" };
          return {
            from: from.name,
            to: to.name,
            mode: profile,
            km: Math.round(route.distanceM / 100) / 10,
            minutes: Math.round(route.durationS / 60),
            note: "Road time without traffic; allow extra in the city.",
          };
        }
        default:
          return { error: `unknown tool ${name}` };
      }
    }

    const system =
      SYSTEM +
      (citySlug ? `\nThe user is browsing: ${CITIES.find((c) => c.slug === citySlug)?.name ?? citySlug}.` : "") +
      (focus ? `\nThe user is looking at: ${focus.name}.` : "");
    const convo: Msg[] = [{ role: "system", content: system }, ...turns];

    let reply = "";
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          reasoning_effort: "low",
          max_completion_tokens: 800,
          temperature: 0.3,
          messages: convo,
          ...(round < MAX_TOOL_ROUNDS ? { tools: TOOLS, tool_choice: "auto" } : {}),
        }),
      });
      if (!res.ok) {
        console.error("groq", res.status, (await res.text()).slice(0, 300));
        throw new Error(res.status === 429 ? "ASSISTANT_BUSY" : "ASSISTANT_UNAVAILABLE");
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
      };
      const msg = data.choices?.[0]?.message;
      const calls = msg?.tool_calls ?? [];
      if (calls.length === 0) {
        reply = msg?.content?.trim() ?? "";
        break;
      }
      convo.push({ role: "assistant", content: msg?.content ?? null, tool_calls: calls });
      for (const call of calls) {
        let out: unknown;
        try {
          out = await runTool(call.function.name, JSON.parse(call.function.arguments || "{}"));
        } catch (e) {
          out = { error: String(e).slice(0, 120) };
        }
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out).slice(0, 4000) });
      }
    }
    if (!reply) throw new Error("ASSISTANT_UNAVAILABLE");

    // Cards for the places the reply names, in order of appearance.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const text = norm(reply);
    const places = [...seen.values()]
      .map((p) => ({ p, at: text.indexOf(norm(p.name)) }))
      .filter(({ p, at }) => at >= 0 && norm(p.name).length >= 3)
      .sort((a, b) => a.at - b.at)
      .slice(0, 6)
      .map(({ p }) => toCard(p));

    return { reply, places };
  },
});
