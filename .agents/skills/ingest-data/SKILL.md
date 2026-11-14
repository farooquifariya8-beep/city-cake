---
name: ingest-data
description: "Change what we pull from OpenStreetMap, Wikipedia or OSRM, add a city, or add a category. Use for any change to convex/ingest.ts, convex/routes.ts or convex/lib/cities.ts."
---

# Ingest data

Read `docs/data.md` first. Its policy column is a hard limit.

## Rules

- Only Convex actions call external APIs. Send `User-Agent: CityCake/0.1 (college project)`.
- Upsert by `osmId`. A rerun must leave the same rows. Delete rows for a city only when the city is removed.
- Pause between calls: 2 s for Overpass, 1 s for Wikipedia and OSRM. On 429 or 504, wait and retry once, then log and move on.
- A new category goes into `convex/lib/categories.ts` and the mapping table in `docs/data.md` in the same commit.
- A new city goes into `convex/lib/cities.ts` with a real centre, radius, distance and a one-line blurb that a local would agree with.

## Prove it

1. `bunx convex dev --once` pushes cleanly.
2. `bunx convex run ingest:prewarmAll` finishes. Read the per-city counts it logs.
3. `bunx convex run places:listByCity '{"citySlug":"sambhajinagar","group":"explore","limit":10}'` returns real landmarks at the top. If Bibi Ka Maqbara is not near the top, the score is wrong.
