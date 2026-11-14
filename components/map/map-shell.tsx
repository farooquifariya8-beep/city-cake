"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";
import { Map, MapControls, MapRoute } from "@/components/ui/map";
import { AppMenu } from "@/components/shell/app-menu";
import { LogoMark } from "@/components/shell/logo";
import { NavTabs } from "@/components/shell/nav-tabs";
import { HOME_CITY } from "@/lib/geo";
import Link from "next/link";
import { CameraController } from "./camera";
import {
  MapStoreProvider,
  useHighlight,
  useMapActions,
  useScene,
} from "./map-store";
import { HoverPin, OriginPin, SelectedPin, StopPin } from "./pins";
import { PlacesLayer } from "./places-layer";
import { MapSheet } from "./sheet";

const STYLES = {
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

function MapCanvas() {
  const scene = useScene();
  const highlight = useHighlight();
  const { setHighlight, bus } = useMapActions();
  const router = useRouter();

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
      styles={STYLES}
      center={[HOME_CITY.lng, HOME_CITY.lat]}
      zoom={12}
      minZoom={5}
      maxZoom={18}
      dragRotate={false}
      pitchWithRotate={false}
      className="absolute inset-0"
    >
      <PlacesLayer points={scene.points} onPointClick={onPointClick} onHover={setHighlight} />
      {scene.route && scene.route.length > 1 && (
        <>
          <MapRoute
            id="cc-route-casing"
            coordinates={scene.route}
            color="#ffffff"
            width={9}
            opacity={0.95}
            interactive={false}
          />
          <MapRoute
            id="cc-route"
            coordinates={scene.route}
            color="#2f6fde"
            width={5}
            opacity={1}
            interactive={false}
          />
        </>
      )}
      {scene.origin && <OriginPin origin={scene.origin} />}
      {scene.stops?.map((s, i) => (
        <StopPin key={`${s.id}-${i}`} point={s} index={i} />
      ))}
      {hovered && <HoverPin key={hovered.id} point={hovered} />}
      {scene.selected && <SelectedPin key={scene.selected.id} point={scene.selected} />}
      <CameraController camera={scene.camera} />
      <MapControls position="top-right" showZoom showLocate className="hidden md:flex" />
    </Map>
  );
}

/** Persistent map, the top control and the sheet for /explore, /place, /nearby, /map. */
export function MapShell({ children }: { children: ReactNode }) {
  return (
    <MapStoreProvider>
      <div className="fixed inset-0 overflow-hidden bg-muted">
        <MapCanvas />
        <header className="material absolute inset-x-3 top-[max(env(safe-area-inset-top),12px)] z-30 flex h-14 items-center gap-2 rounded-[20px] px-2.5 md:top-3 md:right-auto md:w-[400px]">
          <Link
            href="/explore"
            aria-label="City Cake, go to explore"
            className="rounded-[10px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogoMark />
          </Link>
          <NavTabs className="min-w-0 flex-1" />
          <AppMenu />
        </header>
        <MapSheet>{children}</MapSheet>
      </div>
    </MapStoreProvider>
  );
}
