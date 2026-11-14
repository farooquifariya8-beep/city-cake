# Architecture

## Data flow

```
OSM Overpass ──┐
Wikipedia ─────┼─► convex/ingest.ts (actions) ─► places, cities tables ─► queries ─► UI
OSRM ──────────┘   convex/routes.ts (action)  ─► routeCache table    ─► action  ─► map
                   convex/lib/planner.ts (pure) ◄── convex/planner.ts (query) ◄── /plan
```

The browser talks only to Convex. Convex talks to the outside world, inside actions, and caches what it gets.

## Convex modules and their contracts

These signatures are the contract between backend and UI. Change one only by updating this table and every caller in the same commit.

| Function | Kind | Args | Returns |
|---|---|---|---|
| `cities.list` | query | none | city rows sorted by `distanceKm` |
| `cities.get` | query | `{ slug }` | city row or null |
| `places.listByCity` | query | `{ citySlug, group?, categories?, limit? }` | `PlaceCard[]` sorted by score |
| `places.get` | query | `{ id }` | full place row or null |
| `places.getMany` | query | `{ ids }` | `PlaceCard[]` |
| `places.search` | query | `{ text, citySlug?, group? }` | up to 20 `PlaceCard` |
| `places.nearby` | query | `{ lat, lng, categories?, citySlug?, radiusM?, limit? }` | `PlaceCard & { distanceM }` nearest first |
| `routes.get` | action | `{ points: {lat,lng}[], profile: "driving" \| "foot" }` | `{ coordinates: [lng,lat][], distanceM, durationS }` or null |
| `planner.preview` | query | `{ citySlug, prefs }` | `{ title, days, estCostInr }` |
| `favorites.list` / `ids` / `toggle` | query / query / mutation | `toggle: { placeId }` | cards, ids, saved boolean |
| `itineraries.list` / `get` / `save` / `rename` / `remove` | queries and mutations | see file | rows |
| `users.me` | query | none | `{ id, username }` or null |
| `ingest.prewarmAll` | internal action | none | logs counts per city |
| `assistant.chat` | action | `{ messages, citySlug?, focusPlaceId? }` | `{ reply, places: PlaceCard[] }` (Groq, grounded in our places) |
| `itineraries.update` | mutation | `{ id, title?, days, prefs?, estCostInr? }` | edits a saved plan |

`PlaceCard` is defined by `toCard` in `convex/places.ts`. `prefs`, day and stop shapes are validators in `convex/schema.ts`. Import types from `convex/_generated` and those validators. Don't redeclare them in the UI.

Mutations that need an account throw `NOT_SIGNED_IN`. The UI checks `useConvexAuth()` first and sends signed-out users to `/signin?next=...`, so the error is a backstop.

## Routes

| Path | Rendering | Notes |
|---|---|---|
| `/` | server | redirects to `/explore` |
| `/explore` | map shell, client sheet | city switcher (`?city=`), category chips (`?cat=`), search (`?q=`), photo cards, clustered markers |
| `/place/[id]` | map shell, client sheet | photo, facts, save, directions from the visitor or the city centre, facilities within 2 km, more to see |
| `/nearby` | map shell, client sheet | geolocation with city-centre fallback, or a place's point (`?lat=&lng=&from=`); facility chips, radius, route here |
| `/map` | map shell, client sheet | route builder: `?stops=id,id` (2 to 10), `?mode=foot`, `?city=`, `?cat=` |
| `/plan` | content shell, client | preferences in the URL, live `planner.preview`, save (`?save=1` saves after sign-in) |
| `/assistant` | map shell, client sheet | chat UI, not connected: a labelled system note links to /plan and /map; places named in a message (matched with `places.search`) show as photo cards and on the map |
| `/saved` | content shell, client, protected | saved places and trips (rename, delete, open) |
| `/saved/[id]` | content shell, client, protected | one saved itinerary |
| `/signin`, `/signup` | content shell, client | username and password, honour `?next=` |

Two shells. `app/(map)/layout.tsx` renders one persistent MapLibre map (`components/map/map-shell.tsx`) with a floating top control and a sheet (left panel on desktop, bottom sheet on mobile); pages set what the map shows through `components/map/map-store.tsx` (`useMapScene`, `useMapPointClick`). `app/(content)/layout.tsx` is a slim top bar and a centred column up to 1100 px. Both show the same five tabs (Explore, Nearby, Map, Plan, Saved), an assistant button and the account menu.

## Auth

`lib/serverAuth.ts` lists the functions allowed to create a session. `lib/convexAuth.tsx` builds the proxy helpers and the server provider. `proxy.ts` protects `/saved` and bounces signed-in users away from the auth pages. Client code uses `useConvexAuth` from `convex/react`, `useAuthActions` from `@convex-dev/auth/react`, and `useSignInWithUsernamePassword` / `useSignUpWithUsernamePassword` from `@convex-dev/auth/methods/username-password/react`.
