"use client";

import { useEffect, useRef } from "react";
import { Map, MapMarker, MapRoute, MarkerContent, useMap } from "@/components/ui/map";
import { Map3D, MAP_STYLES, useMapStyle } from "@/components/map/map-style";
import { StopPin } from "@/components/map/pins";
import { boundsOf, HOME_CITY, type LngLat } from "@/lib/geo";
import type { DraftStop } from "@/lib/plan-draft";

export type Puck = { point: LngLat; bearing: number; speed: number; accuracy: number };

const DESKTOP = "(min-width: 768px)";

/** Keep the arrow low on the screen with the road ahead above it, clear of the banner and the panel. */
function followPadding() {
  const h = window.innerHeight;
  if (window.matchMedia(DESKTOP).matches) return { top: Math.round(h * 0.4), bottom: 60, left: 430, right: 40 };
  return { top: Math.round(h * 0.42), bottom: 200, left: 20, right: 20 };
}

function overviewPadding() {
  if (window.matchMedia(DESKTOP).matches) return { top: 60, bottom: 60, left: 450, right: 60 };
  return { top: 170, bottom: 230, left: 36, right: 36 };
}

/** Closer in at walking pace, further out on the highway. */
const zoomFor = (speedMs: number) => (speedMs > 22 ? 15.3 : speedMs > 12 ? 16 : 16.8);

function Camera({
  puck,
  follow,
  overview,
  overviewKey,
  onUserMove,
}: {
  puck: Puck | null;
  follow: boolean;
  overview: { lat: number; lng: number }[] | LngLat[];
  overviewKey: string;
  onUserMove: () => void;
}) {
  const { map, isLoaded } = useMap();
  const moved = useRef(onUserMove);
  useEffect(() => {
    moved.current = onUserMove;
  });

  // A drag, pinch or rotate by the user stops following.
  useEffect(() => {
    if (!map) return;
    const onStart = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) moved.current();
    };
    map.on("dragstart", onStart);
    map.on("rotatestart", onStart);
    map.on("pitchstart", onStart);
    map.on("wheel", onStart);
    const onTouch = (e: { originalEvent: TouchEvent }) => {
      if (e.originalEvent.touches.length > 1) moved.current();
    };
    map.on("touchstart", onTouch);
    return () => {
      map.off("touchstart", onTouch);
      map.off("dragstart", onStart);
      map.off("rotatestart", onStart);
      map.off("pitchstart", onStart);
      map.off("wheel", onStart);
    };
  }, [map]);

  // Following: ride behind the arrow, heading up.
  useEffect(() => {
    if (!map || !isLoaded || !follow || !puck) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({
      center: puck.point,
      bearing: puck.bearing,
      pitch: 58,
      zoom: zoomFor(puck.speed),
      padding: followPadding(),
      duration: reduce ? 0 : 900,
      easing: (t) => t,
    });
  }, [map, isLoaded, follow, puck]);

  // Overview: the whole road left, north up.
  useEffect(() => {
    if (!map || !isLoaded || follow) return;
    const pts = overview.map((p) => (Array.isArray(p) ? { lng: p[0], lat: p[1] } : p));
    const b = boundsOf(pts);
    if (!b) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(b, { padding: overviewPadding(), maxZoom: 15, bearing: 0, pitch: 30, duration: reduce ? 0 : 900 });
    // overviewKey says when the road changed; the points follow from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, follow, overviewKey]);

  return null;
}

/** The visitor: a flat arrow that lies on the road and points the way they're going. */
function PuckMarker({ puck }: { puck: Puck }) {
  return (
    <MapMarker
      longitude={puck.point[0]}
      latitude={puck.point[1]}
      rotation={puck.bearing}
      rotationAlignment="map"
      pitchAlignment="map"
      anchor="center"
    >
      <MarkerContent className="pointer-events-none">
        <svg viewBox="0 0 56 56" className="size-14 drop-shadow-[0_3px_5px_rgb(0_0_0/0.35)]" aria-label="You">
          <circle cx="28" cy="28" r="22" fill="white" />
          <path d="M28 11 L40 40 L28 33.5 L16 40 Z" style={{ fill: "var(--route)", stroke: "var(--route)" }} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      </MarkerContent>
    </MapMarker>
  );
}

export function JourneyMap({
  done,
  ahead,
  stops,
  reached,
  puck,
  follow,
  routeKey,
  onUserMove,
}: {
  done: LngLat[] | null;
  ahead: LngLat[] | null;
  stops: DraftStop[];
  reached: number;
  puck: Puck | null;
  follow: boolean;
  routeKey: string;
  onUserMove: () => void;
}) {
  const [mode] = useMapStyle();
  const left = stops.slice(reached);
  const overview = ahead && ahead.length > 1 ? ahead : left.length ? left : stops;
  const first = stops[0] ?? HOME_CITY;

  return (
    <Map
      styles={MAP_STYLES[mode]}
      center={[first.lng, first.lat]}
      zoom={12}
      minZoom={4}
      maxZoom={19}
      maxPitch={70}
      className="absolute inset-0"
    >
      <Map3D mode={mode} />
      {done && done.length > 1 && (
        <MapRoute id="j-done" coordinates={done} color="#8b95a1" width={6} opacity={0.75} interactive={false} />
      )}
      {ahead && ahead.length > 1 && (
        <>
          <MapRoute id="j-ahead-casing" coordinates={ahead} color="#ffffff" width={11} opacity={0.95} interactive={false} />
          <MapRoute id="j-ahead" coordinates={ahead} color="#2f6fde" width={7} opacity={1} interactive={false} />
        </>
      )}
      {stops.map((s, i) => (
        <StopPin key={s.key} point={{ id: s.key, name: s.name, category: s.category, lat: s.lat, lng: s.lng }} index={i} />
      ))}
      {puck && <PuckMarker puck={puck} />}
      <Camera puck={puck} follow={follow} overview={overview} overviewKey={`${routeKey}:${reached}`} onUserMove={onUserMove} />
    </Map>
  );
}
