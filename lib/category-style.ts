// One place that turns a category hue into colours. Every marker, chip, tab,
// card edge and legend reads from here, so a new category in
// convex/lib/categories.ts gets its colour without touching a component.

import { CATEGORIES, type Category } from "@/convex/lib/categories";

export type CategoryTone = {
  /** Solid field: markers, active tabs, card edges. */
  fill: string;
  /** Quiet background behind text of the same hue. */
  soft: string;
  /** Hairline around a soft field. */
  border: string;
  /** Text and icons on `soft` or on the page surface. */
  ink: string;
  /** Text and icons on `fill`. */
  on: string;
};

type Lch = [l: number, c: number, h: number];

// Matte and earthy on purpose. Mural pigment, not screen neon.
const RECIPE: Record<"light" | "dark", Record<keyof CategoryTone, [l: number, c: number]>> = {
  light: {
    fill: [0.53, 0.125],
    soft: [0.935, 0.04],
    border: [0.83, 0.07],
    ink: [0.37, 0.1],
    on: [0.985, 0.012],
  },
  dark: {
    fill: [0.74, 0.115],
    soft: [0.29, 0.045],
    border: [0.42, 0.07],
    ink: [0.85, 0.085],
    on: [0.19, 0.02],
  },
};

const NEUTRAL_HUE = 70;

export function categoryHue(category: string): number {
  return category in CATEGORIES ? CATEGORIES[category as Category].hue : NEUTRAL_HUE;
}

const css = ([l, c, h]: Lch) => `oklch(${l} ${c} ${h})`;

/** oklch strings for a hue, for one theme. */
export function toneFromHue(hue: number, theme: "light" | "dark"): CategoryTone {
  const r = RECIPE[theme];
  return {
    fill: css([...r.fill, hue]),
    soft: css([...r.soft, hue]),
    border: css([...r.border, hue]),
    ink: css([...r.ink, hue]),
    on: css([...r.on, hue]),
  };
}

export function categoryTone(category: string, theme: "light" | "dark"): CategoryTone {
  return toneFromHue(categoryHue(category), theme);
}

/** oklch to sRGB hex, clipped. MapLibre paint properties need hex. */
export function oklchToHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    "#" +
    lin
      .map((v) => {
        const x = Math.min(1, Math.max(0, v));
        const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

/** Hex fill for a category, for map layers. */
export function categoryHex(category: string, theme: "light" | "dark"): string {
  const [l, c] = RECIPE[theme].fill;
  return oklchToHex(l, c, categoryHue(category));
}

const vars = (t: CategoryTone) =>
  `--cat-fill:${t.fill};--cat-soft:${t.soft};--cat-border:${t.border};--cat-ink:${t.ink};--cat-on:${t.on}`;

/**
 * The stylesheet that gives any element with `data-cat="<key>"` the five
 * `--cat-*` variables for the current theme. Rendered once in the root layout.
 * Tailwind reads them as `bg-cat`, `bg-cat-soft`, `border-cat-border`,
 * `text-cat-ink` and `text-cat-on`.
 */
export function categoryStylesheet(): string {
  const light = [`[data-cat]{${vars(toneFromHue(NEUTRAL_HUE, "light"))}}`];
  const dark = [`.dark [data-cat]{${vars(toneFromHue(NEUTRAL_HUE, "dark"))}}`];
  for (const [key, { hue }] of Object.entries(CATEGORIES)) {
    light.push(`[data-cat="${key}"]{${vars(toneFromHue(hue, "light"))}}`);
    dark.push(`.dark [data-cat="${key}"]{${vars(toneFromHue(hue, "dark"))}}`);
  }
  return [...light, ...dark].join("");
}
