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
| `routes.navigate` | action | `{ points: {lat,lng}[] }` (2 to 10, driving) | `NavRoute`: the `routes.get` shape plus `legs: {distanceM,durationS}[]` and `steps` (OSRM maneuvers with leg, type, modifier, exit, road name and ref, location), cached under a `nav:` key, or null |
| `planner.preview` | query | `{ citySlug, prefs }` | `{ title, days, estCostInr }` |
| `favorites.list` / `ids` / `toggle` | query / query / mutation | `toggle: { placeId }` | cards, ids, saved boolean |
| `itineraries.list` / `get` / `save` / `rename` / `remove` | queries and mutations | see file | rows |
| `users.me` | query | none | `{ id, username }` or null |
| `ingest.prewarmAll` | internal action | none | logs counts per city |
| `assistant.chat` | action | `{ messages, citySlug?, focusPlaceId? }` | `{ reply, places: PlaceCard[] }` (Groq, grounded in our places) |
| `itineraries.update` | mutation | `{ id, title?, days, prefs?, estCostInr? }` | edits a saved plan |

`PlaceCard` is defined by `toCard` in `convex/places.ts`. `prefs`, day and stop shapes are validators in `convex/schema.ts`. Import types from `convex/_generated` and those validators. Don't redeclare them in the UI.

Mutations that need an account throw `NOT_SIGNED_IN`. Pages are gated in `proxy.ts`, so a signed-out visitor never reaches them; the UI checks `useConvexAuth()` as a backstop for an expired session.

## Routes

| Path | Rendering | Notes |
|---|---|---|
| `/` | server, cached hourly | landing: hero search, real photos and counts, day trips, feature previews |
| `/explore` | map shell, client sheet | city switcher (`?city=`), category chips (`?cat=`), search (`?q=`), photo cards, clustered markers |
| `/place/[id]` | map shell, client sheet | photo, facts, save, directions from the visitor or the city centre, facilities within 2 km, more to see |
| `/nearby` | map shell, client sheet | geolocation with city-centre fallback, or a place's point (`?lat=&lng=&from=`); facility chips, radius, route here |
| `/map` | map shell, client sheet | route builder: `?stops=id,id` (2 to 10), `?mode=foot`, `?city=`, `?cat=` |
| `/plan` | map shell, client sheet | road trip flow (`plan-flow.tsx`): where to (`geo.search`, `useMyLocation`, days), pick stops (`routes.get` line first, then `trips.alongRoute`; chips, night hints, pin taps toggle), then `planRouteTrip` in the browser fills the builder (days, stops, reorder, times, save or update). Wizard state in `citycake:road-trip`, draft in `citycake:plan-draft`. "Build it yourself" opens the builder alone. Each day has "Start journey" (`/journey?day=n`) with Google Maps as a secondary link |
| `/journey` | full screen, client, no shell | `?day=n` of the plan draft. `useLivePosition` watches GPS, `routes.navigate` routes from the fix through the day's stops, `lib/navigation.ts` snaps each fix to the road (forward from the last snap, using heading) and reads the next turn, time and distance left, the leg and arrival. Reroutes after three fixes over 50 m off the road. Overview of the day when location is off or the first stop is over 400 km away. Wake lock while open |
| `/assistant` | redirect | to `/explore?chat=1`. The assistant is a corner chat on every map page (full-screen sheet on phones) calling `assistant.chat` with the city and the focused place |
| `/saved` | content shell, client, protected | saved places and trips (rename, delete, open) |
| `/saved/[id]` | content shell, client, protected | one saved itinerary |
| `/signin`, `/signup` | auth shell (`app/(auth)/layout.tsx`), no top bar | username and password, honour `?next=` (default `/plan`); cream mesh and a real photo, always light |

Two shells. `app/(map)/layout.tsx` renders one persistent MapLibre map (`components/map/map-shell.tsx`) with a floating top control and a sheet (left panel on desktop, bottom sheet on mobile); pages set what the map shows through `components/map/map-store.tsx` (`useMapScene`, `useMapPointClick`). `app/(content)/layout.tsx` is a slim top bar and a centred column up to 1100 px. Both show the same five tabs (Explore, Nearby, Map, Plan, Saved), an assistant button and the account menu.

## Auth

`lib/serverAuth.ts` lists the functions allowed to create a session. `lib/convexAuth.tsx` builds the proxy helpers and the server provider. `proxy.ts` protects every app page (everything but `/` and the auth pages) and sends signed-in users on an auth page to `next` or `/plan`. Client code uses `useConvexAuth` from `convex/react`, `useAuthActions` from `@convex-dev/auth/react`, and `useSignInWithUsernamePassword` / `useSignUpWithUsernamePassword` from `@convex-dev/auth/methods/username-password/react`.
