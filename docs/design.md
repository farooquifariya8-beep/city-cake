# Design

## Direction

The app should feel like it belongs to this place. The Deccan has its own colours, and we take them from three real sources:

- **Ajanta murals.** Red ochre, yellow ochre, malachite green and lapis blue, on lime-plaster cream. Matte, earthy, never neon.
- **Paithani silk.** Peacock teal, deep magenta, and a gold zari border. Rich colour in bands and borders.
- **Deccan basalt.** The near-black volcanic stone the caves are cut from. Our dark surfaces and our ink.

It should be beautiful to look at and calm to use. It is colourful, not monochrome and not plain paper. Colour does a job: every category has its own hue (from `convex/lib/categories.ts`), so a map marker, a tab, a card edge and a legend chip for "heritage" share one ochre. A screen reads by colour before you read a word.

The design agent decides how far to take this. These are the fixed points.

## Fixed rules

From [unslop](https://github.com/heydamir/unslop), adapted:

- **Banned:** hue-shifting gradients, gradient text, coloured glows and shadows, blobs, orbs, glassmorphism, neon borders, emoji as icons, `animate-pulse` and `animate-ping` decoration, shimmer, parallax, bento grids for their own sake.
- **Allowed and encouraged:** solid colour fields, bands and borders (the Paithani border is a real pattern from the region), illustration, textures drawn from real materials, a small tonal shift inside one hue.
- **Spacing:** a 4 px grid. Panels pad 16, cards 20 to 24, page edges 24 to 32. Inner radius is the outer radius minus the padding, never below 4.
- **Type:** Bricolage Grotesque for display (`--font-display`), Geist for text, Geist Mono for numbers that line up (distances, times, prices). Weights 400 and 500, 600 at most. Sentence case everywhere. Tabular figures for data.
- **Icons:** lucide only, 16 or 18 px, 1.5 stroke, in the text colour or the category colour.
- **Layout:** app pages keep a 240 to 280 px sidebar on desktop and a bottom bar on mobile. The map gets real height. One primary action per screen, at most one secondary. Long headlines align left.
- **Motion:** `motion` only. One easing curve for the app. At most one entrance per page load. `transition-colors`, not `transition-all`. Respect `prefers-reduced-motion`.
- **Copy:** says what the thing does. No "AI-powered", no "seamless", "unlock", "magic", "supercharge". No exclamation marks. No trailing period on short labels. Numbers and names are real, from the data.
- **Contrast:** text meets 4.5:1 on its surface in both themes.

## Theme tokens

`app/globals.css` holds the tokens. Category colours come from the hue in `categories.ts` through one helper (`lib/category-style.ts`), so a new category gets its colour for free. Light mode is the default; dark mode uses basalt surfaces and the same hues at adjusted lightness.

## Illustration

- **Hero:** an ASCII rendering of a real local landmark (Bibi Ka Maqbara or the Kailasa temple) through the ASCII Magic MCP, tinted in one ink from the palette, shown as a static image with real alt text.
- **Explainers:** isometric SVG figures in the style of the [anatomy skill](https://skills.wheresryan.sh/anatomy) where a mechanism needs explaining, such as how the planner fills a day. Azimuth 45, elevation 30, one lit accent, a "Fig n" card frame, and live numbers from the same model the figure shows.
- **Empty states:** small line drawings or ASCII motifs, never stock clip art.

## Performance budget

- First load JS on `/` under 150 kB gzipped. MapLibre loads only on pages with a map.
- No WebGL outside at most one hero, lazy loaded, with a static fallback.
- Images through `next/image` with sizes set. Wikipedia thumbnails, not originals.
