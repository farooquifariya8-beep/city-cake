"use client";

import { useAction } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ArrowRight, Loader2, LocateFixed, MapPin, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { GeoResult } from "@/convex/geo";
import { CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { Button } from "@/components/ui/button";
import { HOME_CITY } from "@/lib/geo";
import { EXAMPLES, setRoadTrip, useRoadTrip, type End } from "@/lib/road-trip";
import type { MyLocation } from "@/lib/use-my-location";
import { Stepper } from "./stepper";

/** Debounced search for any place in India: 600 ms, three letters or more. */
function usePlaceSearch(text: string, near?: { lat: number; lng: number }) {
  const search = useAction(api.geo.search);
  const [state, setState] = useState<{ q: string; results: GeoResult[]; error?: boolean }>({ q: "", results: [] });
  const q = text.trim();
  useEffect(() => {
    if (q.length < 3) return;
    let live = true;
    const t = setTimeout(() => {
      search({ text: q, lat: near?.lat, lng: near?.lng })
        .then((results) => live && setState({ q, results }))
        .catch(() => live && setState({ q, results: [], error: true }));
    }, 600);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, near?.lat, near?.lng, search]);
  const active = q.length >= 3;
  return {
    active,
    loading: active && state.q !== q,
    results: active && state.q === q ? state.results : [],
    error: active && state.q === q && !!state.error,
  };
}

/** One end of the trip: a chosen place, "my location", or a search box. */
function EndField({
  label,
  value,
  mine,
  onChange,
  near,
}: {
  label: string;
  value: End | null;
  /** Set on the start field: shown while no place is typed in. */
  mine?: { loc: MyLocation; locate: () => void; useMine: () => void; using: boolean };
  onChange: (end: End | null) => void;
  near?: { lat: number; lng: number };
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { active, loading, results, error } = usePlaceSearch(editing ? text : "", near);

  const usingMine = !!mine?.using && !editing;
  const showChip = !editing && (value || usingMine);

  function pick(r: { name: string; lat: number; lng: number }) {
    onChange({ name: r.name, lat: r.lat, lng: r.lng });
    setText("");
    setEditing(false);
  }

  return (
    <div>
      <span className="block px-1 pb-1 text-[12px] font-medium text-muted-foreground">{label}</span>
      {showChip ? (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            requestAnimationFrame(() => input.current?.focus());
          }}
          className="press flex h-11 w-full items-center gap-2.5 rounded-xl bg-black/[0.055] px-3 text-left dark:bg-white/10"
        >
          {usingMine ? (
            <LocateFixed className="size-4 shrink-0 text-[#2f6fde]" strokeWidth={2} aria-hidden />
          ) : (
            <MapPin className="size-4 shrink-0 text-[var(--route)]" strokeWidth={2} aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
            {usingMine ? <MineLabel loc={mine!.loc} /> : value!.name}
          </span>
          <span className="shrink-0 text-[13px] text-link">Change</span>
        </button>
      ) : (
        <label className="flex h-11 items-center gap-2 rounded-xl bg-black/[0.055] px-3 text-muted-foreground focus-within:ring-3 focus-within:ring-ring/30 dark:bg-white/10">
          <MapPin className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <input
            ref={input}
            aria-label={label}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setEditing(true);
            }}
            onFocus={() => setEditing(true)}
            placeholder="Search a town or place in India"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-label="Searching" />}
          {editing && (value || mine) && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setEditing(false);
              }}
              className="shrink-0 text-[13px] font-medium text-link"
            >
              Cancel
            </button>
          )}
          {text && !loading && (
            <button type="button" aria-label="Clear" onClick={() => setText("")} className="shrink-0">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </label>
      )}

      {editing && (
        <div className="mt-1.5 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline" aria-live="polite">
          {mine && (
            <button
              type="button"
              onClick={() => {
                mine.useMine();
                if (mine.loc.status !== "found") mine.locate();
                onChange(null);
                setText("");
                setEditing(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#2f6fde]/10 text-[#2f6fde]">
                <LocateFixed className="size-3.5" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-[14px] font-medium">My location</span>
            </button>
          )}
          {!active ? (
            <p className="px-3 py-2.5 text-[13px] text-muted-foreground">Type at least three letters</p>
          ) : loading ? (
            <p className="px-3 py-2.5 text-[13px] text-muted-foreground">Searching</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-muted-foreground">
              {error ? "Search isn't answering. Try again." : "No places match. Try a town name."}
            </p>
          ) : (
            results.slice(0, 6).map((r) => (
              <button
                key={r.osmId}
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
              >
                <CategoryTile category={r.category} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{r.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{r.address ?? categoryLabel(r.category)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Where trips start until the visitor's location is known. */
const HOME_END: End = { name: HOME_CITY.name, lat: HOME_CITY.lat, lng: HOME_CITY.lng };

function MineLabel({ loc }: { loc: MyLocation }) {
  if (loc.status === "found") return <>My location{loc.town ? <span className="font-normal text-muted-foreground">, {loc.town}</span> : null}</>;
  if (loc.status === "locating") return <>Finding you</>;
  const why = loc.status === "denied" ? "location is off" : loc.status === "unavailable" ? "location isn't available" : "until we have your location";
  return (
    <>
      {HOME_CITY.name}
      <span className="font-normal text-muted-foreground">, {why}</span>
    </>
  );
}

/** Step 1: start, destination and days. */
export function WhereStep({
  loc,
  locate,
  onFind,
}: {
  loc: MyLocation;
  locate: () => void;
  onFind: (from: End) => void;
}) {
  const trip = useRoadTrip();
  const [asked, setAsked] = useState(false);
  const found = loc.status === "found" ? loc : null;
  const mineEnd = useMemo<End | null>(
    () => (found ? { name: found.town ?? "My location", lat: found.lat, lng: found.lng } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [found?.lat, found?.lng, found?.town],
  );
  const locating = loc.status === "locating";
  // "My location" means the city until a real fix arrives.
  const from = trip.from ?? mineEnd ?? (locating ? null : HOME_END);
  const waiting = asked && locating;

  // "Find" pressed before the location arrived: go once it does. Moving to
  // the next step unmounts this one, so nothing here needs resetting.
  useEffect(() => {
    if (waiting && mineEnd && trip.to) onFind(mineEnd);
  }, [waiting, mineEnd, trip.to, onFind]);

  function find() {
    if (!trip.to) return;
    if (from) return onFind(from);
    setAsked(true);
    locate();
  }

  const canFind = !!trip.to && !waiting;

  return (
    <div className="px-4 pt-2 pb-4 md:pt-5">
      <h1 className="large-title">Where to?</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Pick a start and an end. We&apos;ll find sights, food, stays and fuel on the road between them.
      </p>

      <div className="relative mt-4 space-y-3">
        <EndField
          label="From"
          value={trip.from}
          onChange={(end) => setRoadTrip({ from: end })}
          near={mineEnd ?? undefined}
          mine={{ loc, locate, using: trip.from === null, useMine: () => setRoadTrip({ from: null }) }}
        />
        {trip.from && trip.to && (
          <button
            type="button"
            aria-label="Swap start and destination"
            onClick={() => setRoadTrip((t) => ({ from: t.to, to: t.from }))}
            className="press absolute top-[50px] right-2 z-10 flex size-8 items-center justify-center rounded-full bg-surface text-muted-foreground shadow-sm ring-1 ring-hairline hover:text-foreground"
          >
            <ArrowDownUp className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        )}
        <EndField
          label="To"
          value={trip.to}
          onChange={(end) => setRoadTrip({ to: end })}
          near={from ?? undefined}
        />
      </div>

      <div className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface px-3.5 py-2 ring-1 ring-hairline">
        <span>
          <span className="block text-[15px]">How many days</span>
          <span className="block text-[12px] text-muted-foreground">Nights go at stays along the way</span>
        </span>
        <Stepper value={trip.days} min={1} max={7} onChange={(v) => setRoadTrip({ days: v })} label="days" />
      </div>

      <Button className="mt-4 h-11 w-full rounded-full text-[15px]" disabled={!canFind} onClick={find}>
        {waiting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Finding you
          </>
        ) : (
          "Find places on the way"
        )}
      </Button>
      {!trip.to && <p className="mt-2 text-center text-[13px] text-muted-foreground">Choose where you&apos;re going first</p>}

      <h2 className="mt-6 px-1 text-[13px] font-semibold text-muted-foreground">Or try one</h2>
      <div className="mt-2 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
        {EXAMPLES.map((ex) => (
          <button
            key={`${ex.from.name}-${ex.to.name}`}
            type="button"
            onClick={() => {
              setRoadTrip({ from: ex.from, to: ex.to });
              onFind(ex.from);
            }}
            className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-[14px] hover:bg-accent"
          >
            <span className="min-w-0 flex-1 truncate">
              {ex.from.name} <span className="text-muted-foreground">to</span> {ex.to.name}
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

