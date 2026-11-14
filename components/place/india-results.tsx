"use client";

import { useAction, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { GeoResult } from "@/convex/geo";
import { CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";

export type PickedPlace = { _id: Id<"places">; name: string; category: string; lat: number; lng: number };

/**
 * "More places in India": OSM search beyond the guide, debounced. Choosing a
 * result adds it to our data with geo.open, then hands back a normal place.
 */
/** Debounced OSM search across India, without places already in the guide. */
export function useIndiaSearch(text: string, near?: { lat: number; lng: number }) {
  const search = useAction(api.geo.search);
  const [state, setState] = useState<{ q: string; results: GeoResult[] | null; error?: boolean }>({ q: "", results: null });
  const q = text.trim();

  useEffect(() => {
    if (q.length < 3) return;
    let live = true;
    const t = setTimeout(() => {
      search({ text: q, lat: near?.lat, lng: near?.lng })
        .then((results) => live && setState({ q, results: results.filter((r) => !r.placeId) }))
        .catch(() => live && setState({ q, results: [], error: true }));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, near?.lat, near?.lng, search]);

  const active = q.length >= 3;
  return {
    active,
    loading: active && state.q !== q,
    results: active && state.q === q ? (state.results ?? []) : [],
    error: active && state.q === q && !!state.error,
  };
}

/** Add an India result to our data, then hand back a normal place. */
export function useOpenGeo(onPick: (place: PickedPlace) => void) {
  const open = useMutation(api.geo.open);
  const [opening, setOpening] = useState<string | null>(null);
  async function choose(r: GeoResult) {
    setOpening(r.osmId);
    try {
      const id = await open({ osmId: r.osmId, name: r.name, category: r.category, lat: r.lat, lng: r.lng, address: r.address });
      onPick({ _id: id, name: r.name, category: r.category, lat: r.lat, lng: r.lng });
    } catch {
      toast.error("Could not open that place. Try again.");
    } finally {
      setOpening(null);
    }
  }
  return { choose, opening };
}

export function IndiaResults({
  text,
  near,
  onPick,
  actionLabel,
}: {
  text: string;
  near?: { lat: number; lng: number };
  onPick: (place: PickedPlace) => void;
  actionLabel?: string;
}) {
  const { active, loading, results, error } = useIndiaSearch(text, near);
  const { choose, opening } = useOpenGeo(onPick);
  if (!active) return null;
  const state = { results: loading ? null : results, error };

  return (
    <section className="mt-3" aria-live="polite">
      <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted-foreground">
        More places in India
        {loading && <Loader2 className="size-3.5 animate-spin" aria-label="Searching" />}
      </h3>
      <div className="divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
        {loading && !state.results ? (
          <p className="px-3 py-3 text-[14px] text-muted-foreground">Searching</p>
        ) : !loading && (state.results?.length ?? 0) === 0 ? (
          <p className="px-3 py-3 text-[14px] text-muted-foreground">
            {state.error ? "Search across India isn't answering. Try again." : "No matches"}
          </p>
        ) : (
          (state.results ?? []).slice(0, 8).map((r) => (
            <button
              key={r.osmId}
              type="button"
              disabled={opening !== null}
              onClick={() => choose(r)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
            >
              <CategoryTile category={r.category} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{r.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {r.address ?? categoryLabel(r.category)}
                </span>
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
                {opening === r.osmId ? (
                  <Loader2 className="size-3.5 animate-spin" aria-label="Opening" />
                ) : (
                  `${r.distanceKm < 10 ? r.distanceKm.toFixed(1) : Math.round(r.distanceKm)} km`
                )}
              </span>
              {actionLabel && <span className="sr-only">{actionLabel}</span>}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
