"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIndiaSearch, useOpenGeo } from "@/components/place/india-results";
import { useMyLocation } from "@/lib/use-my-location";
import { CITIES } from "@/convex/lib/cities";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronRight, Loader2, Navigation, SearchX, WifiOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EXPLORE_CATEGORIES } from "@/convex/lib/categories";
import { CategoryChip } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { toMapPoint, useHighlight, useMapActions, useMapScene, type Scene } from "@/components/map/map-store";
import { GeoPlaceCard, PlaceCard, PlaceCardSkeleton } from "@/components/place/place-card";
import { SearchField } from "@/components/shell/search-field";
import { EmptyState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/format";
import { boundsOf, cityBySlug, haversineM } from "@/lib/geo";
import { photoFirst } from "@/lib/photo-first";
import { useUrlState } from "@/lib/use-url-state";
import { CitySwitcher } from "./city-switcher";

const PAGE = 24;

export function ExploreSheet() {
  const { params, set } = useUrlState();
  const router = useRouter();
  const citySlug = cityBySlug(params.get("city")).slug;
  const city = cityBySlug(citySlug);
  const cat = params.get("cat");
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  const [shown, setShown] = useState(PAGE);
  const highlight = useHighlight();
  const { setHighlight } = useMapActions();
  const { loc, locate } = useMyLocation();
  const india = useIndiaSearch(q, { lat: city.lat, lng: city.lng });
  const { choose, opening } = useOpenGeo((p) => router.push(`/place/${p._id}`));

  // Where the visitor is, against the cities in this guide.
  const here = useMemo(() => {
    if (loc.status !== "found") return null;
    const near = CITIES.map((c) => ({ c, km: haversineM(loc.lat, loc.lng, c.lat, c.lng) / 1000 })).sort(
      (a, b) => a.km - b.km,
    )[0];
    const home = CITIES[0];
    return {
      town: loc.town ?? "your location",
      state: loc.state,
      inside: near.km * 1000 <= near.c.radiusM + 10_000 ? near.c : null,
      kmFromHome: Math.round(haversineM(loc.lat, loc.lng, home.lat, home.lng) / 1000),
    };
  }, [loc]);

  // Inside the region with no city picked: open the city the visitor is in.
  useEffect(() => {
    if (here?.inside && !params.get("city") && here.inside.slug !== citySlug) {
      set({ city: here.inside.slug === "sambhajinagar" ? null : here.inside.slug });
    }
  }, [here, params, citySlug, set]);

  // Debounce typing into the URL.
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => set({ q: text.trim() || null }), 250);
    return () => clearTimeout(t);
  }, [text, q, set]);

  const listed = useQuery(
    api.places.listByCity,
    q ? "skip" : { citySlug, group: "explore", categories: cat ? [cat] : undefined },
  );
  const searched = useQuery(
    api.places.search,
    q ? { text: q, citySlug, group: "explore" } : "skip",
  );
  const raw = q ? searched : listed;
  const results = useMemo(
    () => (raw ? photoFirst(q && cat ? raw.filter((p) => p.category === cat) : raw) : raw),
    [raw, q, cat],
  );

  const scene = useMemo<Scene>(
    () => ({
      points: (results ?? []).map(toMapPoint),
      camera: results
        ? {
            key: `explore:${citySlug}:${cat}:${q}:${results.length > 0}`,
            bounds: results.length > 0 ? boundsOf(results) : null,
            center: [city.lng, city.lat],
            zoom: 12,
            maxZoom: 15,
          }
        : null,
    }),
    [results, citySlug, cat, q, city.lat, city.lng],
  );
  useMapScene(scene);

  const changeCity = (slug: string) => {
    setShown(PAGE);
    set({ city: slug === "sambhajinagar" ? null : slug, q: null });
    setText("");
  };

  return (
    <div className="px-4 pt-2 md:pt-5">
      <div className="flex min-h-5 items-center justify-between gap-2 text-[13px] font-medium text-muted-foreground">
        {here ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Navigation className="size-3.5 shrink-0 text-[var(--route)]" strokeWidth={2} aria-hidden />
            <span className="truncate">
              {here.inside?.slug === citySlug
                ? `You're in ${here.town}`
                : here.inside
                  ? `You're in ${here.town}. Showing ${city.name}`
                  : `You're in ${here.town}${here.state ? `, ${here.state}` : ""}, ${here.kmFromHome} km away`}
            </span>
          </span>
        ) : (
          <span>{city.kind === "home" ? "Home city" : `Day trip, ${city.distanceKm} km by road`}</span>
        )}
        {(loc.status === "idle" || loc.status === "locating") && (
          <button
            type="button"
            onClick={locate}
            disabled={loc.status === "locating"}
            className="press flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[var(--route)] hover:bg-accent"
          >
            {loc.status === "locating" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Navigation className="size-3.5" strokeWidth={2} aria-hidden />
            )}
            Use my location
          </button>
        )}
      </div>
      <div className="mt-0.5">
        <CitySwitcher value={citySlug} onChange={changeCity} />
      </div>
      <p className="mt-1.5 text-[14px] leading-5 text-muted-foreground">{city.blurb}</p>

      <SearchField
        className="mt-4"
        value={text}
        onChange={setText}
        label={`Search places in ${city.name}`}
        placeholder={`Search ${city.kind === "home" ? "the city" : city.name}`}
      />

      <div className="fade-x -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <CategoryChip active={!cat} onClick={() => set({ cat: null })} />
        {EXPLORE_CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            category={c}
            active={cat === c}
            onClick={() => {
              setShown(PAGE);
              set({ cat: cat === c ? null : c });
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold tracking-tight">
          {q ? `Results for "${q}"` : cat ? categoryLabel(cat) : "Places to see"}
        </h2>
        {results && (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
            {india.loading && <Loader2 className="size-3.5 animate-spin" aria-label="Searching across India" />}
            {results.length + india.results.length}{" "}
            {results.length + india.results.length === 1 ? "place" : "places"}
          </span>
        )}
      </div>

      {results === undefined ? (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5">
          {Array.from({ length: 6 }, (_, i) => (
            <PlaceCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 && india.results.length === 0 && india.loading ? (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5">
          {Array.from({ length: 4 }, (_, i) => (
            <PlaceCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 && india.results.length === 0 ? (
        <EmptyState
          icon={q ? SearchX : WifiOff}
          title={q ? "No places match" : "Nothing here yet"}
          action={
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setText("");
                set({ q: null, cat: null });
              }}
            >
              Show all places
            </Button>
          }
        >
          {q
            ? `Try a shorter name, or search without the ${cat ? "category filter" : "city"}.`
            : `No ${cat ? categoryLabel(cat).toLowerCase() : "places"} are listed for ${city.name}.`}
        </EmptyState>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5">
            {results.slice(0, shown).map((p, i) => (
              <PlaceCard
                key={p._id}
                place={p}
                preload={i < 2}
                highlighted={highlight === p._id}
                onHover={setHighlight}
                meta={`${categoryLabel(p.category)} · ${formatDistance(
                  haversineM(city.lat, city.lng, p.lat, p.lng),
                )}`}
              />
            ))}
            {india.results.map((r) => (
              <GeoPlaceCard
                key={r.osmId}
                result={r}
                opening={opening === r.osmId}
                onOpen={() => choose(r)}
                meta={`${categoryLabel(r.category)} · ${r.distanceKm < 10 ? r.distanceKm.toFixed(1) : Math.round(r.distanceKm)} km`}
              />
            ))}
          </div>
          {results.length > shown && (
            <Button
              variant="secondary"
              className="mt-5 h-10 w-full rounded-xl"
              onClick={() => setShown((s) => s + PAGE)}
            >
              Show more places
            </Button>
          )}
        </>
      )}

      <Link
        href="/plan"
        className="press mt-6 flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-hairline hover:bg-accent"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarRange className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">Plan your days here</span>
          <span className="block text-[13px] text-muted-foreground">
            A day-by-day route from your budget and interests
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
      <p className="mt-4 text-center text-[12px] text-muted-foreground">
        Distances are from the {city.kind === "home" ? "city" : "town"} centre. Map data from
        OpenStreetMap, photos from Wikipedia.
      </p>
    </div>
  );
}
