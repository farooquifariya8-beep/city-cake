<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# City

A city guide for Chhatrapati Sambhajinagar and its day trips (Ellora, Daulatabad, Ajanta, Paithan, Jalna, Lonar). One app covers places, facilities, a map with routes, a trip planner and a travel assistant. It is a college mini-project, built to be shown live.

The goal: someone who has never been to the city opens the app and knows where to go today, how to get there, and where the nearest pharmacy is.

Read this file in full before any work. Then read the doc for your area:

| Area | Doc |
|---|---|
| What we're building, and what's out of scope | [docs/product.md](docs/product.md) |
| Modules, data flow, function contracts | [docs/architecture.md](docs/architecture.md) |
| OSM ingest, external API policies, prewarm | [docs/data.md](docs/data.md) |
| Look, palette, type, motion, banned patterns | [docs/design.md](docs/design.md) |
| Which component library to use for what | [docs/resources.md](docs/resources.md) |

## Stack

- bun 1.4 as package manager and script runner. Use `bun add`, `bunx`. Never npm or yarn.
- Next.js 16 App Router, React 19, React Compiler on. `proxy.ts` replaces `middleware.ts`.
- Convex for every piece of data. No other database, no Next.js API routes for data.
- Convex Auth v2, username and password, through the SSR proxy. Auth routes live at `app/auth/*`.
- Tailwind v4, shadcn (radix-nova), mapcn on MapLibre, `motion` for animation, lucide icons.
- OpenStreetMap (Overpass, Nominatim), OSRM, Wikipedia. No paid APIs. No API keys.

## Commands

```bash
bun dev                          # Next.js on :3000
bunx convex dev                  # watch and push Convex functions
bunx convex dev --once           # push once (use this from agents)
bunx convex run ingest:prewarmAll  # fetch and cache all cities
bun run build                    # the gate: must pass before you commit
```

## Rules

1. **The landing is public, the app needs an account.** `/`, `/signin` and `/signup` work signed out. Every other page is gated in `proxy.ts`, which sends visitors to `/signin`. Every sign-in lands on `/plan`, and the map pages then ask once for location (`components/map/location-prompt.tsx`), starting in Chhatrapati Sambhajinagar until a fix arrives.
2. **The assistant is real, the planner is rules.** The assistant (`convex/assistant.ts`) calls Groq `openai/gpt-oss-120b` with our places as grounding; the key lives only in the Convex env var `GROQ_API_KEY`, never in code or the browser. It may recommend only places from our data. The trip suggestion is rule-based (`convex/lib/planner.ts`), and users can build or edit any plan by hand.
3. **Data comes from Convex, never from the browser.** The browser never calls Overpass, Nominatim, OSRM or Wikipedia. Convex actions fetch, Convex tables cache, queries serve. See [docs/data.md](docs/data.md) for the policies this protects.
4. **One source of truth for categories and cities.** `convex/lib/categories.ts` and `convex/lib/cities.ts`. UI colours, icons, filters and ingest rules all derive from them. Never hard-code a category list in a component.
5. **Own your files.** When several agents work in parallel, each one edits only the paths its task names. Touching someone else's file means stopping and saying so.
6. **Prove it works.** `bun run build` passes. Convex pushes cleanly. For UI, open the page and look at it. For data, run the query and count the rows. "It compiles" is not done.
7. **Commit at each working unit.** One logical change per commit, message in the imperative, ending with the attribution line the session gives you.
8. **No slop.** The rules in [docs/design.md](docs/design.md) are not suggestions. Writing in the UI follows the unslop skill: plain words, sentence case, no exclamation marks, no em dashes.

## Principles

Cite these by name when one changes a decision. Each is one line here on purpose.

- **Experience first.** Fewer screens, finished properly: loading, empty, error and signed-out states included.
- **Model the domain.** A rule repeated twice becomes data in `convex/lib/`, not a second `if`.
- **Boundary discipline.** Validate at Convex function args and at the edge of an external API. Trust internal types after that.
- **Make operations idempotent.** Ingest upserts by `osmId`. Running prewarm twice leaves the same rows.
- **Subtract before you add.** Delete the placeholder before building beside it. No dead components.
- **Guard the context window.** Send bulk reading to subagents. Keep decisions in the main thread.
- **Fast by default.** Server components where possible, the map loaded only on map pages, images sized, no WebGL outside one hero.

## Layout

```
app/                 routes (see docs/architecture.md for the map)
  auth/              Convex Auth route handlers. Do not edit.
components/ui/       shadcn and registry primitives. Edit only to restyle.
components/          app components, grouped by feature folder
convex/              backend. lib/ holds shared pure code (categories, cities, planner)
lib/                 Next-side helpers (auth setup, utils)
docs/                product, architecture, data, design, resources
.agents/skills/      project skills, one SKILL.md per workflow
```

## Project skills

Load the matching skill before you start that kind of work.

- [`.agents/skills/citycake-mode`](.agents/skills/citycake-mode/SKILL.md): the router. Start here for any multi-step task.
- [`.agents/skills/build-feature`](.agents/skills/build-feature/SKILL.md): a new page or flow, from data shape to finished states.
- [`.agents/skills/design-pass`](.agents/skills/design-pass/SKILL.md): restyle or design a screen to the design doc.
- [`.agents/skills/ingest-data`](.agents/skills/ingest-data/SKILL.md): change what we pull from OSM, or add a city.
- [`.agents/skills/verify`](.agents/skills/verify/SKILL.md): prove a change works before you commit it.
