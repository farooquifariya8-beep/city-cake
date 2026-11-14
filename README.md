<img src="assets/icon.svg" width="64" height="64" alt="">

# City Cake

A city guide for Chhatrapati Sambhajinagar, Maharashtra, and the places a visitor goes from there: Ellora, Daulatabad, Ajanta, Paithan, Jalna and Lonar.

It puts five things in one app:

- **Explore.** Heritage sites, sights, museums, temples, food, cafes, shopping, parks and stays, with photos and summaries from Wikipedia.
- **Nearby.** The closest hospitals, pharmacies, ATMs, transport, fuel, public toilets and police, sorted by distance from you.
- **Map.** Every place on one map. Pick two or more and get a driving or walking route.
- **Plan.** Enter days, budget, interests, group size and pace, and get a day-by-day plan with times and a rough cost. Save it to your account.
- **Assistant.** A travel chat. The interface is built; the model isn't connected yet.

Browsing needs no account. Saving places and plans does.

Built as a college mini-project.

## Run it

You need [bun](https://bun.sh) and a [Convex](https://convex.dev) account.

```bash
bun install
bunx convex dev          # first run creates a deployment and writes .env.local
bunx convex run ingest:prewarmAll   # fetch places for every city (about 3 minutes)
bun dev                  # http://localhost:3000
```

## How it works

Next.js 16 renders the app. Convex stores everything and runs the backend. Place data comes from OpenStreetMap through the Overpass API, photos from Wikipedia, routes from the public OSRM server, and map tiles from CARTO. Convex fetches and caches all of it, so the browser only ever talks to Convex. No external API needs a key.

The trip planner is a set of rules in [`convex/lib/planner.ts`](convex/lib/planner.ts). It fills each day with stops matching your interests, orders them by distance, puts lunch near one o'clock and notes weekly closures. An LLM can replace it later behind the same function.

| Doc | Read it for |
|---|---|
| [AGENTS.md](AGENTS.md) | rules for anyone, human or agent, changing the code |
| [docs/product.md](docs/product.md) | features, planner rules, what's out of scope |
| [docs/architecture.md](docs/architecture.md) | data flow, function contracts, routes |
| [docs/data.md](docs/data.md) | sources, API policies, category mapping, scoring |
| [docs/design.md](docs/design.md) | palette, type, motion, banned patterns |
| [docs/resources.md](docs/resources.md) | which component library is used for what |

## Credits

Map data © OpenStreetMap contributors. Tiles © CARTO. Routing by OSRM. Summaries and images from Wikipedia under their own licences. Design rules adapted from [unslop](https://github.com/heydamir/unslop) (CC BY 4.0).
