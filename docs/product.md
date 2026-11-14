# Product

## Who it's for

A visitor arriving in Chhatrapati Sambhajinagar for two to four days. They know Ajanta and Ellora by name and little else. They have a phone, patchy data, and a group of one to six people.

## What they can do

| Job | Where | Signed out? |
|---|---|---|
| Explore the city: heritage, sights, museums, temples, food, cafes, shopping, parks, stays | `/explore`, `/explore/[city]`, `/place/[id]` | yes |
| Find nearby facilities: hospitals, pharmacies, ATMs, transport, fuel, toilets, police | `/nearby` | yes |
| See places on a map and draw a route between selected places | `/map` | yes |
| Plan a trip from budget, interests, days, group size and pace | `/plan` | yes, saving needs an account |
| Ask the travel assistant | `/assistant` | yes (UI only, not connected) |
| Save favourite places and itineraries | `/saved` | no |
| Create an account and sign in | `/signup`, `/signin` | n/a |

## The region

`convex/lib/cities.ts` lists it. Chhatrapati Sambhajinagar is the home city. The day trips are Ellora with Khuldabad, Daulatabad, Ajanta, Paithan, Jalna and Lonar. Each has a centre, a radius, a distance from the city and a one-line blurb. All of them are prewarmed, so a demo never waits on a public API.

## Planner behaviour (rule-based)

Inputs: days (1 to 5), budget (shoestring, comfort, splurge), interests (category keys), group size (1 to 12), pace (relaxed, balanced, packed), optional start time, and whether to include day trips.

Output: a title, one entry per day with ordered stops, each with a start time, a duration, travel minutes from the previous stop and a short note, plus a rough cost in INR for the whole group.

Rules the planner follows:

- Day 1 stays in the city. When day trips are on, later days go to the highest value day trip that fits (Ellora and Daulatabad together, Ajanta on its own because it is 100 km away).
- Stops per day: relaxed 3, balanced 4, packed 6. A lunch stop from `food` lands near 13:00.
- Stops within a day are ordered by nearest neighbour from the first stop, so the route doesn't zigzag.
- Travel time comes from straight-line distance at 25 km/h in the city and 45 km/h between towns. It is labelled as an estimate.
- Ajanta is closed on Mondays and Ellora on Tuesdays. The planner notes this on the stop and doesn't hide it.
- The same inputs give the same plan.

## The assistant (not connected)

The full chat UI ships: message list, composer, prompt suggestions, and place cards inside messages. Sending a message adds it to the thread and shows a clear line that the assistant isn't connected yet, with links to the planner and the map. It never invents an answer.

## Out of scope

Bookings and payments. Reviews and ratings by users. Live transit times. Offline mode. Languages other than English (Marathi names show where OSM has them). Any city outside the region.
