# Product

## Who it's for

A visitor arriving in Chhatrapati Sambhajinagar for two to four days. They know Ajanta and Ellora by name and little else. They have a phone, patchy data, and a group of one to six people.

## What they can do

The landing page (`/`) is public. Its buttons lead to sign-up, and a new session lands on `/plan`. Every page of the app needs an account.

| Job | Where | Account? |
|---|---|---|
| Explore the city: heritage, sights, museums, temples, food, cafes, shopping, parks, stays | `/explore`, `/explore/[city]`, `/place/[id]` | yes |
| Find nearby facilities: hospitals, pharmacies, ATMs, transport, fuel, toilets, police | `/nearby` | yes |
| See places on a map and draw a route between selected places | `/map` | yes |
| Plan a road trip: start, destination and days, pick sights, food, stays and fuel along the road, get the days planned; or build a trip by hand | `/plan` | yes |
| Drive a planned day with live directions: turn banners, distance and time left, arrival, speed, a heading arrow on the map, rerouting when off the road | `/journey?day=n` | yes |
| Ask the travel assistant (Groq, grounded in our places) | chat popup on map pages | yes |
| Save favourite places and itineraries | `/saved` | no |
| Create an account and sign in | `/signup`, `/signin` | no |

## The region

`convex/lib/cities.ts` lists it. Chhatrapati Sambhajinagar is the home city. The day trips are Ellora with Khuldabad, Daulatabad, Ajanta, Paithan, Jalna and Lonar. Each has a centre, a radius, a distance from the city and a one-line blurb. All of them are prewarmed, so a demo never waits on a public API.

## Planner behaviour (rule-based)

### Road trips on `/plan`

`/plan` opens a three-step flow in the map sheet. One primary button per step.

1. **Where to?** A start (defaults to My location; when location is off the user types a place), a destination, both searched across India with `geo.search` (600 ms debounce, three letters minimum), and a days stepper (1 to 7, default 2). "Find places on the way" moves on. Two one-tap examples: Pune to Chhatrapati Sambhajinagar, and Chhatrapati Sambhajinagar to Ajanta Caves.
2. **Pick your stops.** A summary (from, to, km, drive time, days), category chips (All, Sights, Food, Stays, Fuel, Parks, Shopping, built from category keys) and the places from `trips.alongRoute`, ordered along the road, each showing "km 34 · 0.8 km off road". Tapping a row or its map pin toggles it; picked stops show as numbered pins. When days > 1, stays near where each night falls are marked "Good for night n", as a hint only. The road line comes from `routes.get` right away while the places load (a new road takes about half a minute, then it's cached). A sticky bar reads "4 stops picked · Make my plan".
3. **Your trip.** `planRouteTrip` (`convex/lib/routeTrip.ts`, run in the browser) puts the picks in route order, splits days near an even share of drive and visit time, prefers to end a day at a picked stay, and loads the result into the builder. The user edits times, reorders and saves there. "Back to stops" keeps the picks.

From, to, days, the start the search ran from and the picked keys live in `localStorage` (`citycake:road-trip`), so a refresh keeps the step. "Build it yourself" opens the builder directly for planning by hand.

### City planner (`planner.preview`)

Not shown in the UI right now; kept for an LLM or a later screen. Inputs: days (1 to 5), budget (shoestring, comfort, splurge), interests (category keys), group size (1 to 12), pace (relaxed, balanced, packed), optional start time, and whether to include day trips.

Output: a title, one entry per day with ordered stops, each with a start time, a duration, travel minutes from the previous stop and a short note, plus a rough cost in INR for the whole group.

Rules the planner follows:

- Day 1 stays in the city. When day trips are on, later days go to the highest value day trip that fits (Ellora and Daulatabad together, Ajanta on its own because it is 100 km away).
- Stops per day: relaxed 3, balanced 4, packed 6. A lunch stop from `food` lands near 13:00.
- Stops within a day are ordered by nearest neighbour from the first stop, so the route doesn't zigzag.
- Travel time comes from straight-line distance at 25 km/h in the city and 45 km/h between towns. It is labelled as an estimate.
- Ajanta is closed on Mondays and Ellora on Tuesdays. The planner notes this on the stop and doesn't hide it.
- The same inputs give the same plan.

## The assistant

A chat popup on every map page (a full-screen sheet on mobile). `assistant.chat` sends the conversation to Groq `openai/gpt-oss-120b` with the cities and best-known places as context, and returns the reply plus the places it names, shown as cards the user can open or add to a plan. It recommends only places in our data and never states distances it doesn't know.

## Out of scope

Bookings and payments. Reviews and ratings by users. Live transit times. Offline mode. Languages other than English (Marathi names show where OSM has them). Any city outside the region.
