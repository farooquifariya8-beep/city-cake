"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@/components/ui/map";
import { useMapActions, type Camera } from "./map-store";

const DESKTOP = "(min-width: 768px)";

/** Map padding that keeps the subject clear of the floating sheet. */
function padding(sheetInset: number) {
  if (window.matchMedia(DESKTOP).matches) {
    return { top: 48, bottom: 48, left: 456, right: 72 };
  }
  return { top: 96, bottom: Math.max(sheetInset, 140) + 24, left: 32, right: 32 };
}

/** Moves the map when the page's camera key changes. */
export function CameraController({ camera }: { camera: Camera | null | undefined }) {
  const { map, isLoaded } = useMap();
  const { bus } = useMapActions();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !isLoaded || !camera || camera.key === lastKey.current) return;
    lastKey.current = camera.key;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pad = padding(bus.getInset());
    const duration = reduce ? 0 : 800;

    if (camera.bounds) {
      const [[w, s], [e, n]] = camera.bounds;
      if (Math.abs(e - w) < 1e-4 && Math.abs(n - s) < 1e-4) {
        map.flyTo({ center: [w, s], zoom: camera.maxZoom ?? 15, padding: pad, duration });
      } else {
        map.fitBounds(camera.bounds, { padding: pad, maxZoom: camera.maxZoom ?? 15, duration });
      }
      return;
    }
    if (camera.center) {
      map.flyTo({
        center: camera.center,
        zoom: camera.zoom ?? map.getZoom(),
        padding: pad,
        duration,
        essential: true,
      });
    }
  }, [map, isLoaded, camera, bus]);

  return null;
}
