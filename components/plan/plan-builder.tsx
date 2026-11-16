"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Reorder, useDragControls } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, GripVertical, MapPinPlus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { toMapPoint, useMapClick, useMapPointClick, useMapScene, type MapPoint, type Scene } from "@/components/map/map-store";
import { IndiaResults } from "@/components/place/india-results";
import { PlaceImage } from "@/components/place/place-image";
import { SearchField } from "@/components/shell/search-field";
import { Group } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addMinutes, formatDistance, formatMinutes } from "@/lib/format";
import { boundsOf, boundsOfCoords, cityBySlug } from "@/lib/geo";
import {
  addStop,
  draftToDays,
  emptyDay,
  EMPTY_DRAFT,
  setDraft,
  travelBetween,
  useDraft,
  type DraftStop,
} from "@/lib/plan-draft";
import { useMyLocation } from "@/lib/use-my-location";
import { useRoute } from "@/lib/use-route";
import { cn } from "@/lib/utils";
import { DayNavigation } from "./day-navigation";
import { Stepper } from "./stepper";

export function PlanBuilder({ back }: { back?: { label: string; onClick: () => void } }) {
  const draft = useDraft();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const save = useMutation(api.itineraries.save);
  const update = useMutation(api.itineraries.update);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [custom, setCustom] = useState<{ name: string; placing: boolean } | null>(null);
  const { loc } = useMyLocation();

  const dayIndex = draft.activeDay;
  const day = draft.days[dayIndex];
  const city = cityBySlug(day.citySlug);
  const stops = day.stops;
  const blank = draft.days.every((d) => d.stops.length === 0);

  const cityPlaces = useQuery(api.places.listByCity, { citySlug: day.citySlug, group: "explore", limit: 300 });
  const stopCards = useQuery(
    api.places.getMany,
    stops.some((s) => s.placeId) ? { ids: stops.flatMap((s) => (s.placeId ? [s.placeId] : [])) } : "skip",
  );
  const images = new Map((stopCards ?? []).map((c) => [c._id as string, c.image]));
  const found = useQuery(api.places.search, text.trim() ? { text: text.trim() } : "skip");

  const patchDay = (fn: (stops: DraftStop[]) => DraftStop[]) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((x, i) => (i === d.activeDay ? { ...x, stops: fn(x.stops) } : x)),
    }));

  const addPlace = useCallback(
    (p: { id: string; name: string; category: string; lat: number; lng: number }) => {
      addStop(dayIndex, { placeId: p.id as DraftStop["placeId"], name: p.name, category: p.category, lat: p.lat, lng: p.lng });
      toast(`Added ${p.name} to day ${dayIndex + 1}`);
    },
    [dayIndex],
  );
  const onPin = useCallback(
    (p: MapPoint) => {
      if (stops.some((s) => (s.placeId ?? s.key) === p.id)) toast(`${p.name} is already on day ${dayIndex + 1}`);
      else addPlace(p);
    },
    [addPlace, stops, dayIndex],
  );
  useMapPointClick(onPin);

  const onMapTap = useCallback(
    (ll: { lng: number; lat: number }) => {
      if (!custom?.placing) return;
      addStop(dayIndex, { name: custom.name, category: "attraction", lat: ll.lat, lng: ll.lng });
      toast(`Added ${custom.name} to day ${dayIndex + 1}`);
      setCustom(null);
    },
    [custom, dayIndex],
  );
  useMapClick(custom?.placing ? onMapTap : null);

  // The day's road route.
  const route = useRoute();
  const { run, clear } = route;
  const routeKey = stops.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join(";");
  useEffect(() => {
    if (stops.length < 2) clear();
    else run(stops.slice(0, 10).map((s) => ({ lat: s.lat, lng: s.lng })), "driving");
    // routeKey captures the stop positions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
  const routeCoords = route.state.status === "ready" ? route.state.route.coordinates : null;

  const scene = useMemo<Scene>(() => {
    const stopPoints = stops.map((s) => ({ id: s.placeId ?? s.key, name: s.name, category: s.category, lat: s.lat, lng: s.lng }));
    return {
      points: (cityPlaces ?? []).map(toMapPoint),
      stops: stopPoints,
      route: routeCoords,
      origin: loc.status === "found" ? { lat: loc.lat, lng: loc.lng, kind: "user" } : null,
      camera: routeCoords
        ? { key: `plan-route:${dayIndex}:${routeKey}`, bounds: boundsOfCoords(routeCoords) }
        : stopPoints.length
          ? { key: `plan-stops:${dayIndex}:${routeKey}`, bounds: boundsOf(stopPoints), maxZoom: 15 }
          : { key: `plan-city:${day.citySlug}`, center: [city.lng, city.lat], zoom: 12.5 },
    };
  }, [stops, cityPlaces, routeCoords, dayIndex, routeKey, day.citySlug, city.lat, city.lng, loc]);
  useMapScene(scene);

  async function onSave() {
    if (!isAuthenticated) {
      toast("Sign in to save your plan", { description: "Your draft stays here while you do." });
      router.push("/signin");
      return;
    }
    setSaving(true);
    try {
      const days = draftToDays(draft);
      if (draft.editingId) {
        await update({ id: draft.editingId, title: draft.title, days, estCostInr: draft.estCostInr });
        toast("Saved your changes", { action: { label: "Open saved", onClick: () => router.push(`/saved/${draft.editingId}`) } });
      } else {
        const id = await save({
          title: draft.title,
          citySlug: draft.days[0].citySlug,
          prefs: draft.prefs ?? {
            days: draft.days.length,
            budget: "comfort",
            pace: "balanced",
            interests: [],
            groupSize: 2,
          },
          days,
          estCostInr: draft.estCostInr,
        });
        setDraft((d) => ({ ...d, editingId: id }));
        toast("Saved to your trips", { action: { label: "Open saved", onClick: () => router.push(`/saved/${id}`) } });
      }
    } catch {
      toast.error("Could not save the plan. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const endTime = stops.length ? addMinutes(stops[stops.length - 1].start, stops[stops.length - 1].durationMin) : null;
  const travelTotal = stops.slice(1).reduce((n, s, i) => n + travelBetween(stops[i], s), 0);

  return (
    <div className="px-4 pt-2 pb-4 md:pt-5">
      <div className="flex items-center justify-between gap-2">
        {back ? (
          <button
            type="button"
            onClick={back.onClick}
            className="press -ml-1.5 inline-flex h-8 items-center gap-0.5 rounded-full pr-2.5 pl-1 text-[13px] font-medium text-link hover:bg-accent"
          >
            <ChevronLeft className="size-4" aria-hidden /> {back.label}
          </button>
        ) : (
          <p className="text-[13px] font-medium text-muted-foreground">
            {draft.editingId ? "Editing a saved trip" : "Your plan"}
          </p>
        )}
        <div className="flex gap-1">
          {!blank && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear this plan and start from scratch?")) setDraft(EMPTY_DRAFT);
              }}
              aria-label="Start from scratch"
              title="Start from scratch"
              className="press inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <input
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        aria-label="Trip name"
        className="large-title -mx-1 mt-0.5 w-full rounded-lg bg-transparent px-1 outline-none focus-visible:bg-black/[0.04]"
      />

      {blank && (
        <p className="mt-1 text-[13px] text-muted-foreground">
          Tap places on the map or search below to add them to day 1.
        </p>
      )}

      {/* Day tabs */}
      <div className="fade-x -mx-4 mt-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
        {draft.days.map((d, i) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDraft((x) => ({ ...x, activeDay: i }))}
            aria-pressed={i === dayIndex}
            className={cn(
              "press h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium tabular-nums",
              i === dayIndex ? "bg-primary text-primary-foreground" : "bg-surface ring-1 ring-hairline hover:bg-accent",
            )}
          >
            Day {i + 1}
            <span className="ml-1 opacity-60">{d.stops.length}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, days: [...d.days, emptyDay(d.days.length + 1)], activeDay: d.days.length }))}
          disabled={draft.days.length >= 7}
          aria-label="Add a day"
          className="press flex size-8 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-hairline hover:bg-accent disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={day.title}
          onChange={(e) =>
            setDraft((d) => ({ ...d, days: d.days.map((x, i) => (i === dayIndex ? { ...x, title: e.target.value } : x)) }))
          }
          aria-label={`Day ${dayIndex + 1} name`}
          className="min-w-0 flex-1 rounded-lg bg-transparent text-[17px] font-semibold tracking-tight outline-none focus-visible:bg-black/[0.04]"
        />
        {draft.days.length > 1 && (
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, days: d.days.filter((_, i) => i !== dayIndex), activeDay: dayIndex - 1 }))}
            aria-label={`Remove day ${dayIndex + 1}`}
            className="press flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
      {stops.length > 0 && (
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {stops[0].start} to {endTime} · {formatMinutes(travelTotal)} travel
          {route.state.status === "ready" ? ` · ${formatDistance(route.state.route.distanceM)} by road` : ""}
          {stops.length > 10 ? " · route shows the first 10 stops" : ""}
        </p>
      )}

      <DayNavigation dayNumber={dayIndex + 1} stops={stops} loc={loc} />

      {/* Stops */}
      {stops.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-6 text-center">
          <MapPinPlus className="mx-auto size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <p className="mt-2 text-[15px] font-medium">No stops on day {dayIndex + 1}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Tap a pin on the map, search, or add your own stop.</p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={stops}
          onReorder={(next) => patchDay(() => next)}
          className="mt-3 overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline"
        >
          {stops.map((s, i) => (
            <StopRow
              key={s.key}
              stop={s}
              index={i}
              image={s.placeId ? images.get(s.placeId) : undefined}
              travel={i > 0 ? travelBetween(stops[i - 1], s) : null}
              onChange={(patch) => patchDay((all) => all.map((x) => (x.key === s.key ? { ...x, ...patch } : x)))}
              onRemove={() => patchDay((all) => all.filter((x) => x.key !== s.key))}
            />
          ))}
        </Reorder.Group>
      )}

      {/* Add stops */}
      <h2 className="mt-5 text-[15px] font-semibold">Add to day {dayIndex + 1}</h2>
      <SearchField className="mt-2" value={text} onChange={setText} label="Search places to add" placeholder="Search places" />
      {text.trim() && (
        <Group className="mt-2">
          {found === undefined ? (
            <div className="px-3 py-3"><Skeleton className="h-4 w-2/3" /></div>
          ) : found.length === 0 ? (
            <p className="px-3 py-3 text-[14px] text-muted-foreground">No places match. Add it as your own stop below.</p>
          ) : (
            found.slice(0, 8).map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-3 py-2">
                {p.image ? (
                  <PlaceImage src={p.image} alt="" category={p.category} ratio="1/1" width={330} sizes="32px" className="size-8 shrink-0 rounded-lg" />
                ) : (
                  <CategoryTile category={p.category} size="sm" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {categoryLabel(p.category)} · {cityBySlug(p.citySlug).name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => addPlace(toMapPoint(p))}
                  aria-label={`Add ${p.name}`}
                  className="press flex size-8 items-center justify-center rounded-full bg-[var(--route)]/10 text-[var(--route)] hover:bg-[var(--route)]/20"
                >
                  <Plus className="size-4" strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            ))
          )}
        </Group>
      )}
      {text.trim() && (
        <IndiaResults
          text={text}
          near={{ lat: city.lat, lng: city.lng }}
          onPick={(p) => addPlace({ id: p._id, name: p.name, category: p.category, lat: p.lat, lng: p.lng })}
        />
      )}

      {custom ? (
        <div className={cn("mt-3 rounded-2xl p-3 ring-1", custom.placing ? "bg-[var(--route)]/10 ring-[var(--route)]/30" : "bg-surface ring-hairline")}>
          {custom.placing ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px]">
                Tap the map where <span className="font-medium">{custom.name}</span> is.
              </p>
              <button type="button" onClick={() => setCustom(null)} className="text-[13px] font-medium text-link">
                Cancel
              </button>
            </div>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.name.trim()) setCustom({ name: custom.name.trim(), placing: true });
              }}
            >
              <input
                autoFocus
                value={custom.name}
                onChange={(e) => setCustom({ name: e.target.value, placing: false })}
                placeholder="Name, like Hotel or Friend's home"
                aria-label="Custom stop name"
                className="h-9 min-w-0 flex-1 rounded-lg bg-black/[0.055] px-2.5 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-white/10"
              />
              <Button type="submit" className="h-9 rounded-full px-3.5" disabled={!custom.name.trim()}>
                Next
              </Button>
              <button type="button" aria-label="Cancel" onClick={() => setCustom(null)} className="press flex size-8 items-center justify-center rounded-full hover:bg-accent">
                <X className="size-4" aria-hidden />
              </button>
            </form>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCustom({ name: "", placing: false })}
          className="press mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/[0.055] px-3.5 text-[13px] font-medium hover:bg-black/10 dark:bg-white/10"
        >
          <MapPinPlus className="size-4" aria-hidden /> Add your own stop
        </button>
      )}

      <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 bg-gradient-to-t from-[color-mix(in_oklch,var(--surface)_95%,transparent)] from-60% px-4 pt-3 pb-1">
        <Button className="h-10 flex-1 rounded-full" onClick={onSave} disabled={saving || blank}>
          {saving ? "Saving" : draft.editingId ? "Save changes" : "Save plan"}
        </Button>
        {draft.editingId && (
          <Button asChild variant="outline" className="h-10 rounded-full px-4">
            <Link href={`/saved/${draft.editingId}`}>View saved</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function StopRow({
  stop,
  index,
  image,
  travel,
  onChange,
  onRemove,
}: {
  stop: DraftStop;
  index: number;
  image?: string;
  travel: number | null;
  onChange: (patch: Partial<DraftStop>) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={stop} dragListener={false} dragControls={controls} className="relative bg-surface">
      {travel !== null && (
        <p className="ml-[52px] border-t border-hairline py-1 text-[12px] text-muted-foreground tabular-nums">
          {formatMinutes(travel)} travel, estimated
        </p>
      )}
      <div className={cn("flex items-start gap-2 py-2.5 pr-2 pl-1", travel === null && index > 0 && "border-t border-hairline")}>
        <button
          type="button"
          aria-label={`Drag to reorder ${stop.name}`}
          onPointerDown={(e) => controls.start(e)}
          className="flex h-12 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {image ? (
          <PlaceImage src={image} alt="" category={stop.category} ratio="1/1" width={330} sizes="48px" className="size-12 shrink-0 rounded-xl" />
        ) : (
          <CategoryTile category={stop.category} className="size-12 rounded-xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            {stop.placeId ? (
              <Link href={`/place/${stop.placeId}`} className="min-w-0 flex-1 truncate text-[15px] leading-5 font-medium hover:underline">
                <span className="mr-1 text-[var(--route)] tabular-nums">{index + 1}</span>
                {stop.name}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[15px] leading-5 font-medium">
                <span className="mr-1 text-[var(--route)] tabular-nums">{index + 1}</span>
                {stop.name}
                <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">Your stop</span>
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              type="time"
              value={stop.start}
              onChange={(e) => e.target.value && onChange({ start: e.target.value })}
              aria-label={`Start time for ${stop.name}`}
              className="h-7 rounded-lg bg-black/[0.055] px-1.5 text-[12px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-white/10"
            />
            <Stepper
              size="sm"
              value={stop.durationMin}
              min={15}
              max={480}
              step={15}
              onChange={(v) => onChange({ durationMin: v })}
              label={`time at ${stop.name}`}
              format={(v) => formatMinutes(v)}
            />
          </div>
          {stop.note && <p className="mt-1 text-[12px] leading-4 text-muted-foreground">{stop.note}</p>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${stop.name}`}
          className="press flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </Reorder.Item>
  );
}
