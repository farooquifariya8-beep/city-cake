"use client";

import { useEffect, useMemo, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type * as MapLibreGL from "maplibre-gl";
import { CATEGORY_KEYS } from "@/convex/lib/categories";
import { CategoryIcon } from "@/components/category/category-icon";
import { useMap } from "@/components/ui/map";
import { categoryHex } from "@/lib/category-style";
import type { MapPoint } from "./map-store";

const SOURCE = "cc-places";
const PINS = "cc-places-pins";
const PREFIX = "pin-";
const RATIO = 2;
const SIZE = 30; // CSS px; drawn at RATIO for sharp pins
const ICON = 16;

type Theme = "light" | "dark";

/** The white lucide icon for a category, as a standalone SVG data URL. */
function iconUrl(category: string): string {
  const markup = renderToStaticMarkup(
    <CategoryIcon category={category} size={ICON * RATIO} color="#ffffff" strokeWidth={2.25} />,
  );
  const svg = markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const icons = new Map<string, Promise<HTMLImageElement>>();
function iconImage(category: string) {
  let p = icons.get(category);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = iconUrl(category);
    });
    icons.set(category, p);
  }
  return p;
}

/** Coloured disc, white ring, soft shadow and the white icon, as ImageData. */
async function pinData(category: string, theme: Theme): Promise<ImageData> {
  const px = SIZE * RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const c = px / 2;
  const r = c - 3 * RATIO;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(c, c + RATIO, r + 2 * RATIO, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme === "dark" ? "#1b1c20" : "#ffffff";
  ctx.beginPath();
  ctx.arc(c, c, r + 2 * RATIO, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = categoryHex(category, theme);
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  const icon = await iconImage(category);
  const s = ICON * RATIO;
  ctx.drawImage(icon, c - s / 2, c - s / 2, s, s);
  return ctx.getImageData(0, 0, px, px);
}

const pins = new Map<string, Promise<ImageData>>();
function pin(category: string, theme: Theme) {
  const key = `${category}:${theme}`;
  let p = pins.get(key);
  if (!p) {
    p = pinData(category, theme);
    pins.set(key, p);
  }
  return p;
}

/** Add any pin image the current style lacks. Styles drop images on every swap. */
async function ensurePins(map: MapLibreGL.Map, theme: Theme, only?: string[]) {
  const cats = only ?? CATEGORY_KEYS;
  await Promise.all(
    cats.map(async (c) => {
      const data = await pin(c, theme).catch(() => null);
      const id = PREFIX + c;
      if (!data || !map.style) return;
      if (map.hasImage(id)) map.updateImage(id, data);
      else map.addImage(id, data, { pixelRatio: RATIO });
    }),
  );
}

/** Fonts each basemap serves glyphs for. */
export type FontStack = string[];

/**
 * Every place is a category icon pin, the way Apple Maps does it: no counts.
 * Higher-scored places (and those with photos) win collisions, so zooming in
 * reveals more. Names appear from zoom 14 and give way before pins do.
 */
export function PlacesLayer({
  points,
  font,
  onImagery = false,
  onPointClick,
  onHover,
}: {
  points: MapPoint[];
  font: FontStack;
  /** Labels over satellite imagery: white text, dark halo. */
  onImagery?: boolean;
  onPointClick: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";
  const handlers = useRef({ onPointClick, onHover });
  useEffect(() => {
    handlers.current = { onPointClick, onHover };
  });

  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          name: p.name,
          category: p.category,
          // Lower keys are placed first: photos, then score.
          sort: -((p.score ?? 0) + (p.image ? 1000 : 0)),
        },
      })),
    }),
    [points],
  );
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Pin images: add now, again after any style data change, and on demand.
  useEffect(() => {
    if (!map) return;
    const add = () => void ensurePins(map, theme);
    const missing = (e: { id: string }) => {
      if (e.id.startsWith(PREFIX)) void ensurePins(map, theme, [e.id.slice(PREFIX.length)]);
    };
    add();
    map.on("styledata", add);
    map.on("styleimagemissing", missing);
    return () => {
      map.off("styledata", add);
      map.off("styleimagemissing", missing);
    };
  }, [map, theme]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const dark = theme === "dark" || onImagery;
    map.addSource(SOURCE, { type: "geojson", data: dataRef.current });
    map.addLayer({
      id: PINS,
      type: "symbol",
      source: SOURCE,
      layout: {
        "icon-image": ["concat", "pin-", ["get", "category"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.72, 13, 0.9, 16, 1.05],
        "icon-allow-overlap": false,
        "icon-padding": 3,
        "symbol-sort-key": ["get", "sort"],
        "symbol-z-order": "auto",
        "text-field": ["step", ["zoom"], "", 14, ["get", "name"]],
        "text-font": font,
        "text-size": 11.5,
        "text-anchor": "top",
        "text-offset": [0, 1.15],
        "text-max-width": 9,
        "text-optional": true,
        "text-padding": 2,
      },
      paint: {
        "text-color": dark ? "#f2f2f4" : "#1f2228",
        "text-halo-color": dark ? "rgba(20,20,24,0.85)" : "#ffffff",
        "text-halo-width": 1.6,
      },
    });

    const feature = (e: MapLibreGL.MapLayerMouseEvent) => e.features?.[0]?.properties?.id;
    const onClick = (e: MapLibreGL.MapLayerMouseEvent) => {
      const id = feature(e);
      if (typeof id === "string") handlers.current.onPointClick(id);
    };
    const onEnter = (e: MapLibreGL.MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const id = feature(e);
      if (typeof id === "string") handlers.current.onHover(id);
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      handlers.current.onHover(null);
    };
    map.on("click", PINS, onClick);
    map.on("mouseenter", PINS, onEnter);
    map.on("mouseleave", PINS, onLeave);

    return () => {
      map.off("click", PINS, onClick);
      map.off("mouseenter", PINS, onEnter);
      map.off("mouseleave", PINS, onLeave);
      try {
        if (map.getLayer(PINS)) map.removeLayer(PINS);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch {
        // The style was replaced; its layers are already gone.
      }
    };
    // font is fixed per style; style changes already reset isLoaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, theme, onImagery]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    (map.getSource(SOURCE) as MapLibreGL.GeoJSONSource | undefined)?.setData(data);
  }, [map, isLoaded, data]);

  return null;
}
