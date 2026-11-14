"use client";

import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, LocateOff, MapPinned, Navigation, SearchX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { FACILITY_CATEGORIES } from "@/convex/lib/categories";
import { CategoryChip } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { toMapPoint, useHighlight, useMapActions, useMapScene, type Scene } from "@/components/map/map-store";
import { RouteSummary } from "@/components/map/route-summary";
import { PlaceRow, PlaceRowSkeleton } from "@/components/place/place-row";
import { FiltersPopover } from "@/components/shell/filters-popover";
import { Segmented } from "@/components/shell/segmented";
import { EmptyState, Group } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/format";
import { boundsOf, boundsOfCoords, HOME_CITY, nearestCity } from "@/lib/geo";
import { useOrigin } from "@/lib/use-origin";
import { useRoute, type Profile } from "@/lib/use-route";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";

const RADII = ["1000", "3000", "5000"] as const;
type Radius = (typeof RADII)[number];

export function NearbySheet() {
  const { params, set } = useUrlState();
  const cat = params.get("cat");
  const radius: Radius = RADII.includes(params.get("r") as Radius) ? (params.get("r") as Radius) : "3000";
  // A place page can send its own point here: /nearby?lat=..&lng=..&from=Name
  const pinLat = Number(params.get("lat"));
  const pinLng = Number(params.get("lng"));
  const pinned = Number.isFinite(pinLat) && Number.isFinite(pinLng) && params.has("lat") && params.has("lng");
  const pinName = params.get("from");

  const { origin, locate } = useOrigin(HOME_CITY);
  const route = useRoute();
  const [profile, setProfile] = useState<Profile>("driving");
  const [target, setTarget] = useState<{ id: string; name: string; category: string; lat: number; lng: number } | null>(null);
  const highlight = useHighlight();
  const { setHighlight } = useMapActions();

  useEffect(() => {
    if (!pinned) locate();
  }, [pinned, locate]);

  const center = pinned ? { lat: pinLat, lng: pinLng } : { lat: origin.lat, lng: origin.lng };
  const ready = pinned || (origin.status !== "idle" && origin.status !== "locating");

  const results = useQuery(
    api.places.nearby,
    ready
      ? {
          lat: center.lat,
          lng: center.lng,
          categories: cat ? [cat] : [...FACILITY_CATEGORIES],
          radiusM: Number(radius),
          limit: 60,
        }
      : "skip",
  );

  const routeTo = (p: NonNullable<typeof target>, mode: Profile = profile) => {
    setTarget(p);
    route.run([center, { lat: p.lat, lng: p.lng }], mode);
  };
  const clearRoute = () => {
    setTarget(null);
    route.clear();
  };

  const routeCoords = route.state.status === "ready" ? route.state.route.coordinates : null;
  const scene = useMemo<Scene>(() => {
    const points = (results ?? []).map(toMapPoint);
    return {
      points,
      selected: target,
      route: target ? routeCoords : null,
      origin: ready
        ? { lat: center.lat, lng: center.lng, kind: pinned || origin.status === "user" ? "user" : "centre" }
        : null,
      camera: routeCoords && target
        ? { key: `nearby-route:${target.id}:${routeCoords.length}`, bounds: boundsOfCoords(routeCoords) }
        : results
          ? {
              key: `nearby:${center.lat.toFixed(4)}:${center.lng.toFixed(4)}:${cat}:${radius}:${results.length > 0}`,
              bounds: boundsOf([...results.slice(0, 15), center]),
              maxZoom: 16,
            }
          : null,
    };
    // center is derived from primitives listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, target, routeCoords, ready, center.lat, center.lng, pinned, origin.status, cat, radius]);
  useMapScene(scene);

  const where = pinned
    ? `Around ${pinName ?? "the selected place"}`
    : origin.status === "user"
      ? `Near you, in ${nearestCity(origin.lat, origin.lng).city.name}`
      : `Around the centre of ${HOME_CITY.name}`;

  return (
    <div className="px-4 pt-2 md:pt-5">
      <h1 className="large-title">Nearby</h1>
      <div
        className={cn(
          "mt-2 flex items-start gap-2.5 rounded-2xl p-3 text-[13px] leading-5",
          origin.status === "fallback" && !pinned ? "bg-warn-soft" : "bg-surface ring-1 ring-hairline",
        )}
      >
        {origin.status === "fallback" && !pinned ? (
          <LocateOff className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        ) : pinned ? (
          <MapPinned className="mt-0.5 size-4 shrink-0 text-link" aria-hidden />
        ) : (
          <LocateFixed className="mt-0.5 size-4 shrink-0 text-link" aria-hidden />
        )}
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-medium text-foreground">
            {origin.status === "locating" && !pinned ? "Finding your location" : where}
          </p>
          {origin.status === "fallback" && !pinned && (
            <p className="text-muted-foreground">{origin.reason} Distances are from the city centre.</p>
          )}
          {pinned && <p className="text-muted-foreground">Distances are from that place.</p>}
        </div>
        {(origin.status === "fallback" || pinned) && (
          <button
            type="button"
            onClick={() => {
              clearRoute();
              if (pinned) set({ lat: null, lng: null, from: null });
              else locate();
            }}
            className="press shrink-0 text-[13px] font-medium text-link"
          >
            {pinned ? "Use my location" : "Try again"}
          </button>
        )}
      </div>

      <div className="fade-x -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <CategoryChip active={!cat} onClick={() => (clearRoute(), set({ cat: null }))} label="All facilities" />
        {FACILITY_CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            category={c}
            active={cat === c}
            onClick={() => {
              clearRoute();
              set({ cat: cat === c ? null : c });
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {results ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Searching"}
        </span>
        <FiltersPopover label={`Within ${Number(radius) / 1000} km`} icon={false}>
          <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Search radius</p>
          <Segmented
            label="Search radius"
            value={radius}
            onChange={(r) => (clearRoute(), set({ r: r === "3000" ? null : r }))}
            options={RADII.map((r) => ({ value: r, label: `${Number(r) / 1000} km` }))}
            className="w-full"
          />
        </FiltersPopover>
      </div>

      {target && (
        <div className="mt-3">
          <p className="mb-1.5 px-1 text-[13px] font-medium">Route to {target.name}</p>
          <RouteSummary
            state={route.state}
            profile={profile}
            onProfile={(p) => {
              setProfile(p);
              routeTo(target, p);
            }}
            onRetry={() => routeTo(target)}
            onClose={clearRoute}
            from={pinned ? `From ${pinName ?? "the selected place"}` : origin.status === "user" ? "From your location" : "From the city centre"}
          />
        </div>
      )}

      <Group className="mt-3">
        {results === undefined ? (
          Array.from({ length: 6 }, (_, i) => <PlaceRowSkeleton key={i} />)
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={`No ${cat ? categoryLabel(cat).toLowerCase() : "facilities"} within ${Number(radius) / 1000} km`}
            action={
              radius !== "5000" ? (
                <Button variant="outline" className="rounded-full" onClick={() => set({ r: "5000" })}>
                  Search within 5 km
                </Button>
              ) : undefined
            }
          >
            OpenStreetMap may not list every one. Try a wider radius or another category.
          </EmptyState>
        ) : (
          results.map((p) => (
            <PlaceRow
              key={p._id}
              id={p._id}
              name={p.name}
              category={p.category}
              image={p.image}
              detail={p.address ? `${categoryLabel(p.category)} · ${p.address}` : undefined}
              highlighted={highlight === p._id || target?.id === p._id}
              onHover={setHighlight}
              trailing={
                <div className="flex shrink-0 items-center gap-2">
                  <span className="w-14 text-right text-[13px] text-muted-foreground tabular-nums">
                    {formatDistance(p.distanceM)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      routeTo({ id: p._id, name: p.name, category: p.category, lat: p.lat, lng: p.lng })
                    }
                    aria-label={`Route to ${p.name}`}
                    title="Route here"
                    className="press flex size-8 items-center justify-center rounded-full bg-[var(--route)]/10 text-[var(--route)] hover:bg-[var(--route)]/20"
                  >
                    <Navigation className="size-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              }
            />
          ))
        )}
      </Group>
    </div>
  );
}
