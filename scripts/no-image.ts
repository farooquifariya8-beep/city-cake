import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const cities = await c.query(api.cities.list, {});
const out: string[] = [];
for (const city of cities) {
  const rows = await c.query(api.places.listByCity, { citySlug: city.slug, group: "explore", limit: city.slug === "sambhajinagar" ? 60 : 15 });
  for (const p of rows) if (!p.image) out.push([city.slug, p._id, p.category, p.name, p.lat.toFixed(5), p.lng.toFixed(5)].join("\t"));
}
await Bun.write("scripts/no-image.tsv", out.join("\n"));
console.log(out.length);
