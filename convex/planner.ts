import { query } from "./_generated/server";
import { v } from "convex/values";
import { prefsValidator } from "./schema";
import { CITIES, type CitySeed } from "./lib/cities";
import { DAY_TRIPS, planTrip, type PlannerPlace } from "./lib/planner";

const PLACES_PER_CITY = 300;

/**
 * Preview a plan without saving it. This is the single seam an LLM planner
 * replaces later: keep the args and the `{ title, days, estCostInr }` shape.
 */
export const preview = query({
  args: { citySlug: v.string(), prefs: prefsValidator },
  handler: async (ctx, { citySlug, prefs }) => {
    const rows = await ctx.db.query("cities").collect();
    const cities: CitySeed[] = rows.length > 0 ? rows : CITIES;

    const slugs = new Set([citySlug]);
    if (prefs.includeDayTrips) for (const t of DAY_TRIPS) for (const s of t.slugs) slugs.add(s);

    const lists = await Promise.all(
      [...slugs].map((slug) =>
        ctx.db
          .query("places")
          .withIndex("by_city_group_score", (q) => q.eq("citySlug", slug).eq("group", "explore"))
          .order("desc")
          .take(PLACES_PER_CITY),
      ),
    );
    const places: PlannerPlace[] = lists.flat().map((p) => ({
      _id: p._id,
      name: p.name,
      category: p.category,
      citySlug: p.citySlug,
      lat: p.lat,
      lng: p.lng,
      score: p.score,
      openingHours: p.openingHours,
    }));

    return planTrip({ prefs, places, cities, homeSlug: citySlug, startDate: prefs.startDate });
  },
});
