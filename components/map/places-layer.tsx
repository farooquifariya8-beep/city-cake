"use client";

import { useEffect, useMemo, useRef } from "react";
import type * as MapLibreGL from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import { categoryHex } from "@/lib/category-style";
import type { MapPoint } from "./map-store";

const SOURCE = "cc-places";
const CLUSTERS = "cc-places-clusters";
const COUNTS = "cc-places-counts";
const DOTS = "cc-places-dots";

/**
 * Places as category-coloured dots, clustered when they crowd. Native layers,
 * not DOM markers, so hundreds of places stay smooth.
 */
export function PlacesLayer({
  points,
  onPointClick,
  onHover,
}: {
  points: MapPoint[];
  onPointClick: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
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
        properties: { id: p.id, color: categoryHex(p.category, theme) },
      })),
    }),
    [points, theme],
  );
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const dark = theme === "dark";
    map.addSource(SOURCE, {
      type: "geojson",
      data: dataRef.current,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 42,
    });
    map.addLayer({
      id: CLUSTERS,
      type: "circle",
      source: SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": dark ? "#2b2d33" : "#ffffff",
        "circle-radius": ["step", ["get", "point_count"], 14, 20, 17, 80, 21],
        "circle-stroke-width": 1,
        "circle-stroke-color": dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
      },
    });
    map.addLayer({
      id: COUNTS,
      type: "symbol",
      source: SOURCE,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans Semibold"],
        "text-size": 12,
        "text-allow-overlap": true,
      },
      paint: { "text-color": dark ? "#f2f2f4" : "#1f2228" },
    });
    map.addLayer({
      id: DOTS,
      type: "circle",
      source: SOURCE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 15, 7],
        "circle-stroke-width": 2,
        "circle-stroke-color": dark ? "#1b1c20" : "#ffffff",
      },
    });

    const onDotClick = (e: MapLibreGL.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") handlers.current.onPointClick(id);
    };
    const onDotEnter = (e: MapLibreGL.MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") handlers.current.onHover(id);
    };
    const onDotLeave = () => {
      map.getCanvas().style.cursor = "";
      handlers.current.onHover(null);
    };
    const onClusterClick = async (e: MapLibreGL.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const source = map.getSource(SOURCE) as MapLibreGL.GeoJSONSource | undefined;
      const zoom = await source?.getClusterExpansionZoom(feature.properties?.cluster_id);
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      map.easeTo({ center: [lng, lat], zoom: (zoom ?? map.getZoom() + 2) + 0.2, duration: 450 });
    };
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const unpointer = () => (map.getCanvas().style.cursor = "");

    map.on("click", DOTS, onDotClick);
    map.on("mouseenter", DOTS, onDotEnter);
    map.on("mouseleave", DOTS, onDotLeave);
    map.on("click", CLUSTERS, onClusterClick);
    map.on("mouseenter", CLUSTERS, pointer);
    map.on("mouseleave", CLUSTERS, unpointer);

    return () => {
      map.off("click", DOTS, onDotClick);
      map.off("mouseenter", DOTS, onDotEnter);
      map.off("mouseleave", DOTS, onDotLeave);
      map.off("click", CLUSTERS, onClusterClick);
      map.off("mouseenter", CLUSTERS, pointer);
      map.off("mouseleave", CLUSTERS, unpointer);
      try {
        for (const id of [COUNTS, DOTS, CLUSTERS]) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch {
        // The style was replaced; its layers are already gone.
      }
    };
  }, [map, isLoaded, theme]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const source = map.getSource(SOURCE) as MapLibreGL.GeoJSONSource | undefined;
    source?.setData(data);
  }, [map, isLoaded, data]);

  return null;
}
