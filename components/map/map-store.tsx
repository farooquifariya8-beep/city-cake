"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Bounds, LngLat } from "@/lib/geo";

/** Anything the map can draw as a place. */
export type MapPoint = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  score?: number;
  image?: string;
};

/** A place card or row as a map point. */
export function toMapPoint(p: {
  _id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  score?: number;
  image?: string;
}): MapPoint {
  return { id: p._id, name: p.name, category: p.category, lat: p.lat, lng: p.lng, score: p.score, image: p.image };
}

/** A camera move. The map moves only when `key` changes. */
export type Camera = {
  key: string;
  center?: LngLat;
  zoom?: number;
  bounds?: Bounds | null;
  maxZoom?: number;
};

export type Origin = { lat: number; lng: number; kind: "user" | "centre" };

/** What the current page wants the map to show. */
export type Scene = {
  points: MapPoint[];
  selected?: MapPoint | null;
  stops?: MapPoint[];
  route?: LngLat[] | null;
  origin?: Origin | null;
  camera?: Camera | null;
};

const EMPTY_SCENE: Scene = { points: [] };

type PointHandler = (point: MapPoint) => void;

/** Values the map reads at event time, kept outside React state. */
export type MapBus = {
  getHandler: () => PointHandler | null;
  setHandler: (h: PointHandler | null) => void;
  getInset: () => number;
  setInset: (px: number) => void;
  getMapClick: () => MapClickHandler | null;
  setMapClick: (h: MapClickHandler | null) => void;
};

type MapClickHandler = (lngLat: { lng: number; lat: number }) => void;

function createBus(): MapBus {
  let handler: PointHandler | null = null;
  let inset = 0;
  let mapClick: MapClickHandler | null = null;
  return {
    getMapClick: () => mapClick,
    setMapClick: (h) => {
      mapClick = h;
    },
    getHandler: () => handler,
    setHandler: (h) => {
      handler = h;
    },
    getInset: () => inset,
    setInset: (px) => {
      inset = px;
    },
  };
}

type Actions = {
  setScene: (scene: Scene) => void;
  setHighlight: (id: string | null) => void;
  bus: MapBus;
};

const ActionsContext = createContext<Actions | null>(null);
const SceneContext = createContext<Scene>(EMPTY_SCENE);
const HighlightContext = createContext<string | null>(null);

export function MapStoreProvider({ children }: { children: ReactNode }) {
  const [scene, setScene] = useState<Scene>(EMPTY_SCENE);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [bus] = useState(createBus);
  const actions = useMemo<Actions>(() => ({ setScene, setHighlight, bus }), [bus]);
  return (
    <ActionsContext.Provider value={actions}>
      <SceneContext.Provider value={scene}>
        <HighlightContext.Provider value={highlight}>{children}</HighlightContext.Provider>
      </SceneContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useMapActions(): Actions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useMapActions must be used inside the map shell");
  return ctx;
}

export const useScene = () => useContext(SceneContext);
export const useHighlight = () => useContext(HighlightContext);

/** Show a scene while the calling page is mounted. Pass a memoised object. */
export function useMapScene(scene: Scene) {
  const { setScene } = useMapActions();
  useEffect(() => {
    setScene(scene);
  }, [scene, setScene]);
  useEffect(() => () => setScene(EMPTY_SCENE), [setScene]);
}

/** While set, a tap anywhere on the map calls the handler (for dropping a custom stop). */
export function useMapClick(handler: MapClickHandler | null) {
  const { bus } = useMapActions();
  useEffect(() => {
    bus.setMapClick(handler);
    return () => bus.setMapClick(null);
  }, [handler, bus]);
}

/** Replace what tapping a marker does while the calling page is mounted. */
export function useMapPointClick(handler: PointHandler) {
  const { bus } = useMapActions();
  useEffect(() => {
    bus.setHandler(handler);
    return () => bus.setHandler(null);
  }, [handler, bus]);
}
