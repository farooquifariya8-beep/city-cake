# Data

## Sources

| Source | Used for | Endpoint | Policy we must keep |
|---|---|---|---|
| Overpass | places and facilities | `https://overpass-api.de/api/interpreter` (POST `data=`), with `maps.mail.ru` as a mirror because Convex servers cannot reach overpass-api.de | under 10,000 requests a day, back off on 429 and 504, not as a live backend |
| Nominatim | not used at runtime | n/a | the region is fixed, so we don't geocode |
| OSRM | routes | driving on `router.project-osrm.org`, walking on `routing.openstreetmap.de/routed-foot` (the demo foot profile returns car routes) | 1 request a second, cache every result |
| Wikipedia REST | photo and summary | `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` | descriptive User-Agent, cache |
| Wikidata | photo when only `wikidata=` exists | `https://www.wikidata.org/wiki/Special:EntityData/{Q}.json` | same |
| CARTO basemaps | map tiles | mapcn defaults (voyager light, dark-matter dark) | attribution stays visible |

Every request from Convex sends `User-Agent: CityCake/0.1 (college project)`. Never put a personal email in it.

## Category mapping

`convex/lib/categories.ts` owns the category keys. The ingest maps OSM tags to them:

| Category | OSM tags |
|---|---|
| heritage | `historic=*` (fort, monument, memorial, ruins, castle, tomb, city_gate, archaeological_site) |
| attraction | `tourism=attraction\|viewpoint` |
| museum | `tourism=museum\|gallery` |
| religious | `amenity=place_of_worship` with a name |
| food | `amenity=restaurant\|fast_food` |
| cafe | `amenity=cafe` |
| shopping | `shop=mall\|clothes\|sari\|textiles\|gift\|craft\|books\|market`, `amenity=marketplace` |
| park | `leisure=park\|garden\|nature_reserve` |
| stay | `tourism=hotel\|guest_house\|hostel` |
| hospital | `amenity=hospital\|clinic` |
| pharmacy | `amenity=pharmacy` |
| atm | `amenity=atm\|bank` |
| transport | `railway=station`, `amenity=bus_station`, `aeroway=aerodrome`, `amenity=taxi` |
| fuel | `amenity=fuel` |
| toilets | `amenity=toilets` |
| police | `amenity=police` |

Explore categories keep only named features. Facilities keep unnamed ones with a generated name ("ATM", "Public toilet").

## Score

`score` orders lists. It is a plain sum, so it stays explainable: +40 for a `wikipedia` or `wikidata` tag, +10 each for `website`, `opening_hours`, `phone`, +15 for an image, +5 for a Marathi name, and a category weight (heritage 30, attraction 25, museum 20, religious 10, park 10, others 0). Hand-picked landmarks get +100 from a short list in `convex/lib/landmarks.ts`, so Bibi Ka Maqbara, Kailasa and Daulatabad Fort lead their cities.

## Prewarm

`bunx convex run ingest:prewarmAll` upserts every city in `convex/lib/cities.ts`, one Overpass call per city, a 2 second pause between calls, then enriches up to 40 top places per city from Wikipedia at 1 request a second. It upserts by `osmId`, so a rerun converges to the same rows. It sets `placeCount`, `facilityCount` and `fetchedAt` on each city.

## Enrichment

`bunx convex run enrich:city '{"slug":"sambhajinagar"}'` adds places Overpass missed, using the two sources Convex can still reach. It lays a 5 km grid over the city's radius. A Wikipedia geosearch at each point (10 km, 50 results, 2.5 s apart, backing off on 429) keeps real sights by title, maps them to heritage, religious, museum, park or attraction, and stores the 500 px photo and a two-sentence summary. A sight within 150 m of a place with a similar name (or 1.5 km for an exact name) only fills that place's missing photo and summary; otherwise it is inserted as `wiki/<pageid>` with a score of category weight + 40 for a photo + 10 for a summary. Then one scheduled action per grid point runs Nominatim for restaurant, cafe, hotel, temple, museum, park and mall in a 2.5 km box, 1.1 s apart, and inserts hits whose category matches the phrase and whose `osmId` is new. The last step resets `placeCount` and `facilityCount`. Reruns converge to the same rows.
