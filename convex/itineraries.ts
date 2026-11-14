import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { dayValidator, prefsValidator } from "./schema";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return ctx.db
      .query("itineraries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("itineraries") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const it = await ctx.db.get(id);
    if (!it || it.userId !== userId) return null;
    return it;
  },
});

export const save = mutation({
  args: {
    title: v.string(),
    citySlug: v.string(),
    prefs: prefsValidator,
    days: v.array(dayValidator),
    estCostInr: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("NOT_SIGNED_IN");
    return ctx.db.insert("itineraries", { userId, ...args });
  },
});

export const update = mutation({
  args: {
    id: v.id("itineraries"),
    title: v.optional(v.string()),
    days: v.array(dayValidator),
    prefs: v.optional(prefsValidator),
    estCostInr: v.optional(v.number()),
  },
  handler: async (ctx, { id, title, days, prefs, estCostInr }) => {
    const userId = await getAuthUserId(ctx);
    const it = await ctx.db.get(id);
    if (!it || it.userId !== userId) throw new Error("NOT_FOUND");
    await ctx.db.patch(id, {
      days,
      ...(title !== undefined ? { title } : {}),
      ...(prefs !== undefined ? { prefs } : {}),
      ...(estCostInr !== undefined ? { estCostInr } : {}),
    });
  },
});

export const rename = mutation({
  args: { id: v.id("itineraries"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const userId = await getAuthUserId(ctx);
    const it = await ctx.db.get(id);
    if (!it || it.userId !== userId) throw new Error("NOT_FOUND");
    await ctx.db.patch(id, { title });
  },
});

export const remove = mutation({
  args: { id: v.id("itineraries") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const it = await ctx.db.get(id);
    if (!it || it.userId !== userId) throw new Error("NOT_FOUND");
    await ctx.db.delete(id);
  },
});
