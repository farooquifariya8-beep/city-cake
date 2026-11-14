"use client";

import { useEffect, useRef } from "react";
import type * as MapLibreGL from "maplibre-gl";
import { Crosshair } from "lucide-react";
import { useMap } from "@/components/ui/map";
import { HOME_CITY } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useMapActions, type Camera } from "./map-store";

const DESKTOP = "(min-width: 768px)";

/** Map padding that keeps the subject clear of the floating sheet. */
function padding(sheetInset: number) {
  if (window.matchMedia(DESKTOP).matches) {
    return { top: 48, bottom: 48, left: 456, right: 72 };
  }
  return { top: 120, bottom: Math.max(sheetInset, 140) + 24, left: 32, right: 32 };
}

/** Move the map to a camera, keeping the current tilt so 3D stays 3D. */
export function applyCamera(map: MapLibreGL.Map, camera: Camera, sheetInset: number) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = padding(sheetInset);
  const duration = reduce ? 0 : 800;
  // In 3D keep a tilt; a camera move must not flatten it.
  const pitch = map.getTerrain() ? Math.max(map.getPitch(), 55) : map.getPitch();

  if (camera.bounds) {
    const [[w, s], [e, n]] = camera.bounds;
    if (Math.abs(e - w) < 1e-4 && Math.abs(n - s) < 1e-4) {
      map.flyTo({ center: [w, s], zoom: camera.maxZoom ?? 15, padding: pad, duration, pitch });
    } else {
      map.fitBounds(camera.bounds, { padding: pad, maxZoom: camera.maxZoom ?? 15, duration, pitch });
    }
    return;
  }
  if (camera.center) {
    map.flyTo({
      center: camera.center,
      zoom: camera.zoom ?? map.getZoom(),
      padding: pad,
      duration,
      pitch,
      essential: true,
    });
  }
}

/** Moves the map when the page's camera key changes. */
export function CameraController({ camera }: { camera: Camera | null | undefined }) {
  const { map, isLoaded } = useMap();
  const { bus } = useMapActions();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !isLoaded || !camera || camera.key === lastKey.current) return;
    lastKey.current = camera.key;
    applyCamera(map, camera, bus.getInset());
  }, [map, isLoaded, camera, bus]);

  return null;
}

/** Bring back what the page is about: its results, place or route. */
export function RecenterButton({ camera, className }: { camera: Camera | null | undefined; className?: string }) {
  const { map } = useMap();
  const { bus } = useMapActions();
  return (
    <button
      type="button"
      aria-label="Recenter the map"
      title="Recenter"
      onClick={() =>
        map &&
        applyCamera(
          map,
          camera ?? { key: "home", center: [HOME_CITY.lng, HOME_CITY.lat], zoom: 12 },
          bus.getInset(),
        )
      }
      className={cn(
        "material press flex size-9 items-center justify-center rounded-full text-foreground",
        className,
      )}
    >
      <Crosshair className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
