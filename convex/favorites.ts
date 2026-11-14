import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";
import { toCard } from "./places";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const favs = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const places = await Promise.all(favs.map((f) => ctx.db.get(f.placeId)));
    return places.filter((p): p is Doc<"places"> => p !== null).map(toCard);
  },
});

/** Place ids the signed-in user has saved. Empty when signed out. */
export const ids = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const favs = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return favs.map((f) => f.placeId);
  },
});

/** Returns true when the place is saved after the call. */
export const toggle = mutation({
  args: { placeId: v.id("places") },
  handler: async (ctx, { placeId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("NOT_SIGNED_IN");
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_place", (q) => q.eq("userId", userId).eq("placeId", placeId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("favorites", { userId, placeId });
    return true;
  },
});
