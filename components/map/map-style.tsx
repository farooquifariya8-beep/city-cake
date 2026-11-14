"use client";

import { useCallback, useSyncExternalStore } from "react";
import type * as MapLibreGL from "maplibre-gl";
import { Box, Map as MapIcon, Satellite } from "lucide-react";
import { useMap } from "@/components/ui/map";
import { useEffect } from "react";

export type MapStyleMode = "standard" | "satellite" | "3d";
const KEY = "citycake:map-style";
const DEFAULT: MapStyleMode = "3d";

const SATELLITE: MapLibreGL.StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    imagery: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
    labels: {
      type: "raster",
      tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "imagery", type: "raster", source: "imagery" },
    { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.9 } },
  ],
};

const LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

/** Keyless basemaps for each mode. Standard follows the theme. */
export const MAP_STYLES: Record<MapStyleMode, { light: string | MapLibreGL.StyleSpecification; dark: string | MapLibreGL.StyleSpecification }> = {
  standard: {
    light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
  satellite: { light: SATELLITE, dark: SATELLITE },
  "3d": { light: LIBERTY, dark: LIBERTY },
};

export const STYLE_OPTIONS = [
  { value: "standard" as const, label: <><MapIcon className="size-3.5" aria-hidden /><span className="hidden sm:inline">Standard</span></>, title: "Street map" },
  { value: "satellite" as const, label: <><Satellite className="size-3.5" aria-hidden /><span className="hidden sm:inline">Satellite</span></>, title: "Satellite imagery" },
  { value: "3d" as const, label: <><Box className="size-3.5" aria-hidden />3D</>, title: "Buildings and terrain in 3D" },
];

// A tiny localStorage-backed store, so every map view shares the choice.
const listeners = new Set<() => void>();
function read(): MapStyleMode {
  if (typeof window === "undefined") return DEFAULT;
  const v = window.localStorage.getItem(KEY);
  return v === "standard" || v === "satellite" || v === "3d" ? v : DEFAULT;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useMapStyle(): [MapStyleMode, (m: MapStyleMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const set = useCallback((m: MapStyleMode) => {
    window.localStorage.setItem(KEY, m);
    listeners.forEach((l) => l());
  }, []);
  return [mode, set];
}

const DEM = "cc-dem";
const EXTRUSION = "cc-buildings-3d";

/**
 * In 3D mode: terrain from AWS terrarium tiles, extruded buildings, sky and a
 * tilted camera. Re-applied whenever the style reloads (theme or mode change).
 */
export function Map3D({ mode }: { mode: MapStyleMode }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (mode !== "3d") {
      if (map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 500 });
      return;
    }
    if (!map.getSource(DEM)) {
      map.addSource(DEM, {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
        attribution: "Terrain: Mapzen, AWS",
      });
    }
    map.setTerrain({ source: DEM, exaggeration: 1.3 });
    // Liberty ships a building-3d layer; add ours only if it is missing.
    if (!map.getLayer("building-3d") && !map.getLayer(EXTRUSION) && map.getSource("openmaptiles")) {
      map.addLayer({
        id: EXTRUSION,
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#e3ddd3",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.85,
        },
      });
    }
    try {
      map.setSky({
        "sky-color": "#bcd7f2",
        "horizon-color": "#eef3f7",
        "fog-color": "#f4f1ea",
        "sky-horizon-blend": 0.5,
        "horizon-fog-blend": 0.6,
        "fog-ground-blend": 0.4,
      });
    } catch {
      // Older styles without sky support render without it.
    }
    if (map.getPitch() < 30) map.easeTo({ pitch: 55, duration: 700 });

    return () => {
      try {
        map.setTerrain(null);
      } catch {
        // The style was replaced; nothing to undo.
      }
    };
  }, [map, isLoaded, mode]);

  return null;
}
