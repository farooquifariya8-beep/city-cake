"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Reorder, useDragControls } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Route as RouteIcon, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EXPLORE_CATEGORIES, FACILITY_CATEGORIES } from "@/convex/lib/categories";
import type { PlaceCard } from "@/convex/places";
import { CategoryChip, CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { CitySwitcher } from "@/components/explore/city-switcher";
import { SearchField } from "@/components/shell/search-field";
import { Segmented } from "@/components/shell/segmented";
import { EmptyState, Group } from "@/components/shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance, formatMinutes } from "@/lib/format";
import { boundsOf, boundsOfCoords, cityBySlug } from "@/lib/geo";
import { useRoute, type Profile } from "@/lib/use-route";
import { useUrlState } from "@/lib/use-url-state";
import { useMapPointClick, useMapScene, type MapPoint, type Scene } from "./map-store";
import { PROFILE_OPTIONS } from "./route-summary";

const MAX_STOPS = 10;

export function RouteBuilder() {
  const { params, set } = useUrlState();
  const citySlug = cityBySlug(params.get("city")).slug;
  const city = cityBySlug(citySlug);
  const cat = params.get("cat");
  const profile: Profile = params.get("mode") === "foot" ? "foot" : "driving";
  const stopIds = useMemo(
    () => (params.get("stops") ?? "").split(",").filter(Boolean).slice(0, MAX_STOPS) as Id<"places">[],
    [params],
  );
  const [text, setText] = useState("");

  const places = useQuery(api.places.listByCity, {
    citySlug,
    group: cat ? undefined : "explore",
    categories: cat ? [cat] : undefined,
  });
  const stopRows = useQuery(api.places.getMany, stopIds.length > 0 ? { ids: stopIds } : "skip");
  const found = useQuery(api.places.search, text.trim() ? { text: text.trim(), citySlug } : "skip");

  const stops = useMemo(() => {
    if (stopIds.length === 0) return [];
    if (!stopRows) return undefined;
    const byId = new Map(stopRows.map((s) => [s._id, s]));
    return stopIds.map((id) => byId.get(id)).filter((s): s is PlaceCard => !!s);
  }, [stopIds, stopRows]);

  const setStops = useCallback(
    (ids: string[]) => set({ stops: ids.length ? ids.join(",") : null }),
    [set],
  );

  const addStop = useCallback(
    (p: { id: string; name: string }) => {
      if (stopIds.includes(p.id as Id<"places">)) {
        toast(`${p.name} is already on the route`);
        return;
      }
      if (stopIds.length >= MAX_STOPS) {
        toast(`A route can have up to ${MAX_STOPS} stops`);
        return;
      }
      setStops([...stopIds, p.id]);
    },
    [stopIds, setStops],
  );
  const pointClick = useCallback((p: MapPoint) => addStop(p), [addStop]);
  useMapPointClick(pointClick);

  const route = useRoute();
  const routeKey = stops ? `${stops.map((s) => s._id).join(",")}|${profile}` : "";
  const { run, clear } = route;
  useEffect(() => {
    if (!stops) return;
    if (stops.length < 2) {
      clear();
      return;
    }
    run(
      stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      profile,
    );
    // routeKey captures stops and profile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const routeCoords = route.state.status === "ready" ? route.state.route.coordinates : null;
  const scene = useMemo<Scene>(() => {
    const toPoint = (p: PlaceCard) => ({ id: p._id, name: p.name, category: p.category, lat: p.lat, lng: p.lng });
    return {
      points: (places ?? []).map(toPoint),
      stops: (stops ?? []).map(toPoint),
      route: routeCoords,
      camera: routeCoords
        ? { key: `map-route:${routeKey}`, bounds: boundsOfCoords(routeCoords) }
        : places
          ? {
              key: `map:${citySlug}:${cat}`,
              bounds: boundsOf(places.length ? places : [city]),
              maxZoom: 15,
            }
          : null,
    };
  }, [places, stops, routeCoords, routeKey, citySlug, cat, city]);
  useMapScene(scene);

  const chips = [...EXPLORE_CATEGORIES, ...FACILITY_CATEGORIES];

  return (
    <div className="px-4 pt-2 md:pt-5">
      <h1 className="large-title">Route</h1>
      <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
        Tap places on the map to add stops, 2 to {MAX_STOPS}. Drag to reorder.
      </p>

      {stops === undefined ? (
        <Group className="mt-4">
          {stopIds.map((id) => (
            <div key={id} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </Group>
      ) : stops.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-center">
          <RouteIcon className="mx-auto size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <p className="mt-2 text-[15px] font-medium">No stops yet</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Tap a dot on the map, or search below.
          </p>
        </div>
      ) : (
        <>
          <Reorder.Group
            axis="y"
            values={stops.map((s) => s._id)}
            onReorder={setStops}
            className="mt-4 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline"
          >
            {stops.map((s, i) => (
              <StopItem key={s._id} stop={s} index={i} onRemove={() => setStops(stopIds.filter((id) => id !== s._id))} />
            ))}
          </Reorder.Group>
          <div className="mt-3 flex items-center gap-2">
            <Segmented
              label="Travel mode"
              value={profile}
              onChange={(m) => set({ mode: m === "foot" ? "foot" : null })}
              options={PROFILE_OPTIONS}
              size="sm"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setStops([])}
              className="press h-7 rounded-full px-3 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="mt-3 rounded-2xl bg-surface p-3 ring-1 ring-hairline" aria-live="polite">
            {stops.length < 2 ? (
              <p className="text-[14px] text-muted-foreground">Add one more stop to see the route.</p>
            ) : route.state.status === "ready" ? (
              <>
                <p className="text-[22px] leading-7 font-semibold tracking-tight tabular-nums">
                  {formatMinutes(route.state.route.durationS / 60)}
                  <span className="ml-2 text-[15px] font-normal text-muted-foreground">
                    {formatDistance(route.state.route.distanceM)}
                  </span>
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {profile === "foot" ? "Walking" : "Driving"} through {stops.length} stops, in this order
                </p>
              </>
            ) : route.state.status === "error" ? (
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] text-destructive">{route.state.message}</p>
                <button
                  type="button"
                  className="text-[13px] font-medium text-link"
                  onClick={() => run(stops.map((s) => ({ lat: s.lat, lng: s.lng })), profile)}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <Skeleton className="h-6 w-36 rounded-md" />
                <Skeleton className="mt-2 h-3.5 w-48" />
              </>
            )}
          </div>
        </>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-tight">Add places</h2>
        <CitySwitcher
          size="compact"
          value={citySlug}
          onChange={(slug) => set({ city: slug === "sambhajinagar" ? null : slug })}
        />
      </div>
      <SearchField
        className="mt-2"
        value={text}
        onChange={setText}
        label={`Search places in ${city.name}`}
        placeholder={`Search ${city.name}`}
      />
      {text.trim() ? (
        <Group className="mt-3">
          {found === undefined ? (
            <div className="px-3 py-3"><Skeleton className="h-4 w-2/3" /></div>
          ) : found.length === 0 ? (
            <p className="px-3 py-3 text-[14px] text-muted-foreground">No places match &ldquo;{text}&rdquo;.</p>
          ) : (
            found.slice(0, 8).map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-3 py-2">
                <CategoryTile category={p.category} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{categoryLabel(p.category)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => addStop({ id: p._id, name: p.name })}
                  aria-label={`Add ${p.name} to the route`}
                  className="press flex size-8 items-center justify-center rounded-full bg-[var(--route)]/10 text-[var(--route)] hover:bg-[var(--route)]/20"
                >
                  <Plus className="size-4" strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            ))
          )}
        </Group>
      ) : (
        <>
          <div className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
            <CategoryChip active={!cat} onClick={() => set({ cat: null })} label="All sights" />
            {chips.map((c) => (
              <CategoryChip key={c} category={c} active={cat === c} onClick={() => set({ cat: cat === c ? null : c })} />
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground tabular-nums">
            {places === undefined
              ? "Loading places"
              : `${places.length} ${cat ? categoryLabel(cat).toLowerCase() : "places"} on the map`}
          </p>
          {places && places.length === 0 && (
            <EmptyState icon={RouteIcon} title="None mapped here">
              Try another category or city.
            </EmptyState>
          )}
        </>
      )}
    </div>
  );
}

function StopItem({ stop, index, onRemove }: { stop: PlaceCard; index: number; onRemove: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={stop._id}
      dragListener={false}
      dragControls={controls}
      className="relative flex items-center gap-2.5 bg-surface py-2 pr-2 pl-1.5"
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${stop.name}`}
        onPointerDown={(e) => controls.start(e)}
        className="flex h-8 w-6 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--route)] text-[12px] font-semibold text-white tabular-nums">
        {index + 1}
      </span>
      <Link href={`/place/${stop._id}`} className="min-w-0 flex-1 truncate text-[14px] font-medium hover:underline">
        {stop.name}
      </Link>
      <span data-cat={stop.category} className="hidden text-[12px] text-cat-ink sm:inline">
        {categoryLabel(stop.category)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${stop.name}`}
        className="press flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" strokeWidth={2.25} aria-hidden />
      </button>
    </Reorder.Item>
  );
}
