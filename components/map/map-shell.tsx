"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { animate } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Map, MapControls, MapRoute, RouteProgress, useMap } from "@/components/ui/map";
import { LogoMark } from "@/components/shell/logo";
import { HeaderControls } from "@/components/shell/nav-tabs";
import { Segmented } from "@/components/shell/segmented";
import { HOME_CITY, type LngLat } from "@/lib/geo";
import { CameraController, RecenterButton } from "./camera";
import { MapStoreProvider, useHighlight, useMapActions, useScene } from "./map-store";
import { Map3D, MAP_FONTS, MAP_STYLES, STYLE_OPTIONS, useMapStyle } from "./map-style";
import { HoverPin, OriginPin, SelectedPin, StopPin } from "./pins";
import { PlacesLayer } from "./places-layer";
import { MapSheet } from "./sheet";

/** The route line draws itself from start to end when it appears. */
function AnimatedRoute({ coordinates }: { coordinates: LngLat[] }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = animate(0, 1, {
      duration: reduce ? 0 : 1.1,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: setProgress,
    });
    return () => controls.stop();
  }, [coordinates]);
  return (
    <>
      <MapRoute id="cc-route-casing" coordinates={coordinates} color="#ffffff" width={9} opacity={0.9} interactive={false} />
      <MapRoute
        id="cc-route"
        coordinates={coordinates}
        color="#2f6fde"
        width={5}
        opacity={0.25}
        progress={progress}
        interactive={false}
      >
        <RouteProgress color="#2f6fde" opacity={1} />
      </MapRoute>
    </>
  );
}

/** Forwards plain map taps to the page while it asks for one. */
function MapClickBridge() {
  const { map } = useMap();
  const { bus } = useMapActions();
  useEffect(() => {
    if (!map) return;
    const onClick = (e: { lngLat: { lng: number; lat: number } }) => bus.getMapClick()?.(e.lngLat);
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, bus]);
  return null;
}

function MapCanvas() {
  const scene = useScene();
  const highlight = useHighlight();
  const { setHighlight, bus } = useMapActions();
  const router = useRouter();
  const [mode, setMode] = useMapStyle();

  const byId = useMemo(() => {
    const m = new globalThis.Map(scene.points.map((p) => [p.id, p]));
    for (const s of scene.stops ?? []) m.set(s.id, s);
    return m;
  }, [scene.points, scene.stops]);

  const onPointClick = useCallback(
    (id: string) => {
      const point = byId.get(id);
      if (!point) return;
      const handler = bus.getHandler();
      if (handler) handler(point);
      else router.push(`/place/${id}`);
    },
    [byId, bus, router],
  );

  const hovered = highlight && highlight !== scene.selected?.id ? byId.get(highlight) : undefined;

  return (
    <Map
      styles={MAP_STYLES[mode]}
      center={[HOME_CITY.lng, HOME_CITY.lat]}
      zoom={12}
      minZoom={5}
      maxZoom={18}
      maxPitch={70}
      className="absolute inset-0"
    >
      <Map3D mode={mode} />
      <MapClickBridge />
      <PlacesLayer points={scene.points} font={MAP_FONTS[mode]} onImagery={mode === "satellite"} onPointClick={onPointClick} onHover={setHighlight} />
      {scene.route && scene.route.length > 1 && <AnimatedRoute coordinates={scene.route} />}
      {scene.origin && <OriginPin origin={scene.origin} />}
      {scene.stops?.map((s, i) => (
        <StopPin key={`${s.id}-${i}`} point={s} index={i} />
      ))}
      {hovered && <HoverPin key={hovered.id} point={hovered} />}
      {scene.selected && <SelectedPin key={scene.selected.id} point={scene.selected} />}
      <CameraController camera={scene.camera} />
      <MapControls
        position="top-right"
        showZoom
        showCompass
        showLocate
        showFullscreen
        className="top-3! right-3! hidden md:flex"
      />
      <div className="absolute top-[max(calc(env(safe-area-inset-top)+80px),80px)] right-3 z-10 flex items-center gap-2 md:top-auto md:right-3 md:bottom-9">
        <div className="material rounded-[14px] p-1">
          <Segmented label="Map style" size="sm" value={mode} onChange={setMode} options={STYLE_OPTIONS} />
        </div>
        <RecenterButton camera={scene.camera} />
      </div>
    </Map>
  );
}

/** Persistent map, the top control and the sheet for /explore, /place, /nearby, /map. */
export function MapShell({ children }: { children: ReactNode }) {
  return (
    <MapStoreProvider>
      <div className="fixed inset-0 overflow-hidden bg-muted">
        <MapCanvas />
        <header className="material absolute inset-x-3 top-[max(env(safe-area-inset-top),12px)] z-30 flex h-14 items-center gap-1.5 rounded-[20px] px-1.5 md:top-3 md:right-auto md:w-[400px] md:gap-2 md:px-2">
          <Link
            href="/explore"
            aria-label="City Cake, go to explore"
            className="hidden rounded-[10px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:block"
          >
            <LogoMark />
          </Link>
          <HeaderControls />
        </header>
        <MapSheet>{children}</MapSheet>
      </div>
    </MapStoreProvider>
  );
}
