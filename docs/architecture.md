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

`PlaceCard` is defined by `toCard` in `convex/places.ts`. `prefs`, day and stop shapes are validators in `convex/schema.ts`. Import types from `convex/_generated` and those validators. Don't redeclare them in the UI.

Mutations that need an account throw `NOT_SIGNED_IN`. The UI checks `useConvexAuth()` first and sends signed-out users to `/signin?next=...`, so the error is a backstop.

## Routes

| Path | Rendering | Notes |
|---|---|---|
| `/` | server | landing: what the app is, the region, entry points |
| `/explore` | server shell, client lists | region overview, city cards |
| `/explore/[city]` | server shell, client lists | category tabs, place grid |
| `/place/[id]` | server shell | detail, mini map, save, nearby facilities |
| `/nearby` | client | geolocation with city-centre fallback, facility filters, list and map |
| `/map` | client, map lazy loaded | filters, select places, route between them |
| `/plan` | client | preferences form, generated plan, save |
| `/assistant` | client | chat UI, not connected |
| `/saved` | client, protected | favourites and itineraries |
| `/signin`, `/signup` | client | username and password forms |

App pages share one shell (`app/(app)/layout.tsx`): a sidebar on desktop and a bottom bar on mobile. The landing page and auth pages sit outside it.

## Auth

`lib/serverAuth.ts` lists the functions allowed to create a session. `lib/convexAuth.tsx` builds the proxy helpers and the server provider. `proxy.ts` protects `/saved` and bounces signed-in users away from the auth pages. Client code uses `useConvexAuth` from `convex/react`, `useAuthActions` from `@convex-dev/auth/react`, and `useSignInWithUsernamePassword` / `useSignUpWithUsernamePassword` from `@convex-dev/auth/methods/username-password/react`.
