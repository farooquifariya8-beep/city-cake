import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Maintenance: remove places by exact name in one city (junk from imports). */
export const removePlaces = internalMutation({
  args: { citySlug: v.string(), names: v.array(v.string()) },
  handler: async (ctx, { citySlug, names }) => {
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city", (q) => q.eq("citySlug", citySlug))
      .collect();
    const doomed = rows.filter((p) => names.includes(p.name));
    for (const p of doomed) {
      for (const f of await ctx.db.query("favorites").collect()) if (f.placeId === p._id) await ctx.db.delete(f._id);
      await ctx.db.delete(p._id);
    }
    return doomed.length;
  },
});
