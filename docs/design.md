# Design

## Direction: Apple Maps meets Airbnb

The app is map-first and photo-led. It is soft, friendly and precise. The map is the canvas. Content sits on floating rounded sheets above it, the way Apple Maps does it. Places are shown as Airbnb-style photo cards: big rounded images, the name, one line of facts.

Reference points from the owner's bookmarks:
- [Lenso UI](https://ui.lenso.dev/) for the iOS design language on the web: sheets, grouped lists, segmented controls, large titles.
- [square-ui](https://github.com/ln-dev7/square-ui) for crafted shadcn app layouts.
- [flightcn](https://flightcn.yencheng.dev/) for route drawing on mapcn.
- [Details that make interfaces feel better](https://jakub.kr/writing/details-that-make-interfaces-feel-better) and [Invisible Details](https://invisibledetails.com/) for the finish: concentric radii, optical alignment, tabular numbers, press states, transitions.

Local character comes through colour, not decoration. Each category keeps its hue from `convex/lib/categories.ts`, taken from the region (Ajanta ochre and malachite, Paithani peacock and magenta, lapis). Category colour appears in markers, small icon tiles, chips and fallback image tiles. Surfaces stay neutral and light, so the photos and the map carry the colour.

## Images must blend in

- Every image sits in the same frame: a fixed aspect ratio (4:3 on cards, 16:9 on details), `object-cover`, the card's radius, and a hairline inner border (`ring-1 ring-black/5 ring-inset`) so light photos don't bleed into the page.
- Places without a photo get a fallback tile in the category's soft tint with the category icon. It is the same size and radius as a photo, so a grid of mixed cards reads evenly.
- No ASCII art, no decorative illustration inside the app.

## Fixed rules

- **Banned:** hue-shifting gradients, gradient text, coloured glows, blobs, neon, emoji icons, pulse or shimmer decoration, parallax.
- **Allowed:** a frosted material (`bg-background/80 backdrop-blur-xl` plus a hairline border) only on panels floating over the map, as Apple Maps does. Nowhere else.
- **Spacing:** a 4 px grid. Concentric radii: inner radius is the outer radius minus the padding.
- **Radius:** sheets 20 to 24, cards 16, controls 10 to 12, chips full.
- **Shadow:** one soft elevation for floating sheets (`0 8px 32px rgb(0 0 0 / 0.12)` with a 1 px hairline). Cards sit flat with a hairline or a very light shadow.
- **Type:** Geist for all text. Large titles at 28 to 34 px, weight 600, slight negative tracking. Body 15 px. Geist Mono or `tabular-nums` for distances, times and prices. Sentence case.
- **Icons:** lucide, 16 to 20 px, 1.75 stroke.
- **Layout:** desktop is a full-height map with a left floating sheet (380 to 420 px) for lists and details. Mobile is the map with a bottom sheet. Pages without a map (plan, saved, assistant) use a centred content column up to 1100 px with a slim top bar.
- **Motion:** `motion`, one spring for sheets, 150 to 200 ms colour and opacity transitions, `prefers-reduced-motion` respected.
- **Copy:** say what the thing does, plain words, no exclamation marks, no "AI-powered".
- **Contrast:** 4.5:1 for text in both themes.

## Theme tokens

`app/globals.css` holds the tokens. Category colours come from the hue in `categories.ts` through `lib/category-style.ts`. Light mode is the default and the priority. Dark mode must work but needn't be perfect.

## Performance budget

- MapLibre loads once, in the app shell, client side only.
- `next/image` for every photo with `sizes` set, Wikipedia thumbnails only.
- No WebGL effects.
