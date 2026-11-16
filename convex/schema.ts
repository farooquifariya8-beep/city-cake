import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const prefsValidator = v.object({
  days: v.number(),
  budget: v.union(v.literal("shoestring"), v.literal("comfort"), v.literal("splurge")),
  interests: v.array(v.string()), // Category keys
  groupSize: v.number(),
  pace: v.union(v.literal("relaxed"), v.literal("balanced"), v.literal("packed")),
  startTime: v.optional(v.string()), // "09:00"
  startDate: v.optional(v.string()), // "2026-12-01", used for weekly closures
  includeDayTrips: v.optional(v.boolean()),
});

export const stopValidator = v.object({
  placeId: v.optional(v.id("places")),
  name: v.string(),
  category: v.string(),
  lat: v.number(),
  lng: v.number(),
  start: v.string(), // "09:30"
  durationMin: v.number(),
  travelMin: v.optional(v.number()), // from the previous stop
  note: v.optional(v.string()),
});

/** One OSRM maneuver: where it happens and the road it leads onto. */
export const navStepValidator = v.object({
  leg: v.number(),
  type: v.string(),
  modifier: v.optional(v.string()),
  exit: v.optional(v.number()),
  name: v.string(),
  ref: v.optional(v.string()),
  distanceM: v.number(),
  durationS: v.number(),
  lng: v.number(),
  lat: v.number(),
});

export const navLegValidator = v.object({ distanceM: v.number(), durationS: v.number() });

export const dayValidator = v.object({
  day: v.number(),
  title: v.string(),
  citySlug: v.string(),
  stops: v.array(stopValidator),
});

export default defineSchema({
  users: defineTable({}),

  cities: defineTable({
    slug: v.string(),
    name: v.string(),
    localName: v.string(),
    kind: v.union(v.literal("home"), v.literal("daytrip")),
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    distanceKm: v.number(),
    blurb: v.string(),
    placeCount: v.number(),
    facilityCount: v.number(),
    fetchedAt: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  places: defineTable({
    osmId: v.string(), // "node/123"
    citySlug: v.string(),
    name: v.string(),
    category: v.string(), // Category key from convex/lib/categories.ts
    group: v.union(v.literal("explore"), v.literal("facility")),
    lat: v.number(),
    lng: v.number(),
    address: v.optional(v.string()),
    openingHours: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    description: v.optional(v.string()),
    wikipedia: v.optional(v.string()), // "en:Bibi Ka Maqbara"
    wikidata: v.optional(v.string()),
    image: v.optional(v.string()),
    // "representative": the photo shows this kind of place in the region, not the place itself.
    imageKind: v.optional(v.union(v.literal("exact"), v.literal("representative"))),
    summary: v.optional(v.string()),
    score: v.number(), // popularity heuristic, higher first
    tags: v.optional(v.record(v.string(), v.string())),
  })
    .index("by_osmId", ["osmId"])
    .index("by_city", ["citySlug"])
    .index("by_city_category", ["citySlug", "category"])
    .index("by_city_group_score", ["citySlug", "group", "score"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["citySlug", "group", "category"],
    }),

  routeCache: defineTable({
    key: v.string(),
    profile: v.string(),
    coordinates: v.array(v.array(v.number())),
    distanceM: v.number(),
    durationS: v.number(),
    // Only on turn-by-turn routes from routes.navigate.
    legs: v.optional(v.array(navLegValidator)),
    steps: v.optional(v.array(navStepValidator)),
  }).index("by_key", ["key"]),

  // Places along a road route, from trips.alongRoute. Expires after a week.
  corridorCache: defineTable({
    key: v.string(),
    stops: v.any(),
  }).index("by_key", ["key"]),

  favorites: defineTable({
    userId: v.id("users"),
    placeId: v.id("places"),
  })
    .index("by_user", ["userId"])
    .index("by_user_place", ["userId", "placeId"]),

  itineraries: defineTable({
    userId: v.id("users"),
    title: v.string(),
    citySlug: v.string(),
    prefs: prefsValidator,
    days: v.array(dayValidator),
    estCostInr: v.optional(v.number()),
  }).index("by_user", ["userId"]),
});
