# Resources

Researched on 2026-11-14. Install registry components with `bunx shadcn@latest add <name>`. Pick one owner per component name: a registry install with `--overwrite` replaces the file of the same name.

| Resource | What it is | Use it for | Install |
|---|---|---|---|
| [mapcn](https://www.mapcn.dev/llms.txt) | MapLibre map components, shadcn registry | every map: `Map`, `MapMarker`, `MarkerPopup`, `MapRoute`, `MapClusterLayer`, `MapControls`, `useMap` | installed at `components/ui/map.tsx` |
| [beUI](https://beui.dev/llms.txt) | motion components | `number-ticker` for stats, `morphing-tabs`, `timeline` and `sortable-stack` for itineraries, `date-range-picker` | `@beui/<name>` |
| [chanhdai](https://chanhdai.com/llms.txt) | motion components | `dot-grid-spotlight` (canvas 2D, light), `text-swap`, `line-nav`, `scroll-fade-effect`, `theme-switcher` | `@ncdai/<name>` |
| [TuffUI](https://tuffui.com/llms.txt) | AI agent UI, props driven, no `useChat` | the assistant: `chat-thread`, `prompt-suggestions`, `result-carousel`, agent composer | `https://tuffui.com/r/<name>.json` |
| [Fluid Functionalism](https://www.fluidfunctionalism.com/llms.txt) | motion principles and components | the idea of one shared spring and one gliding hover highlight. Copy the principle, avoid `--overwrite` on our primitives | `@fluid/<name>` |
| [Bklit](https://bklit.com/llms.txt) | d3 chart components | a budget breakdown chart on the plan page, if one earns its place | `@bklit/<name>` |
| [libraries.dev](https://libraries.dev/llms.txt) | single-component npm packages | `border-beam` on the assistant composer, `thinking-orbs` for a waiting state | `bun add <name>`, read `https://libraries.dev/llms/<name>.md` first |
| [ui-sdk](https://ui-sdk.dev/llms.txt) | headless primitives (Vercel Labs) | only if a date or timeline primitive is missing elsewhere | `bun add @ui-sdk/react @ui-sdk/core` |
| [ReactDrops](https://github.com/crisjavr/reactdrops) | WebGL and physics effects | at most one hero effect, such as `topographic-flow`, lazy loaded | `https://reactdrops.dev/r/<name>.json` |
| [anatomy](https://skills.wheresryan.sh/anatomy) | isometric SVG explainer figures | the planner explainer figure | skill, see docs/design.md |
| ASCII Magic MCP | image to ASCII render | the landmark hero | MCP tools `stylize_image`, `create_upload` |

Skip: Kobra (free tier is personal-use only, and shadcn covers the same ground), reanimate (a dev-time skill that needs macOS or Linux).

Keep `motion` as the only animation library. Don't add GSAP.
