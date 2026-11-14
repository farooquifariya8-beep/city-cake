"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { CalendarRange, Check, ChevronRight, Heart, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { categoryLabel } from "@/components/category/category-icon";
import { PlaceCard, PlaceCardSkeleton } from "@/components/place/place-card";
import { EmptyState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInr } from "@/lib/format";
import { cityBySlug } from "@/lib/geo";

export function SavedPage() {
  const places = useQuery(api.favorites.list);
  const trips = useQuery(api.itineraries.list);

  return (
    <div>
      <h1 className="large-title">Saved</h1>

      <section className="mt-6" aria-labelledby="trips">
        <h2 id="trips" className="mb-3 text-[19px] font-semibold tracking-tight">
          Trips
        </h2>
        {trips === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-2xl bg-surface ring-1 ring-hairline">
            <EmptyState
              icon={CalendarRange}
              title="No saved trips"
              action={
                <Button asChild className="h-9 rounded-full px-4">
                  <Link href="/plan">Plan a trip</Link>
                </Button>
              }
            >
              Plan a few days, then save the plan to find it here.
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
            {trips.map((t) => (
              <TripRow key={t._id} trip={t} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="places">
        <h2 id="places" className="mb-3 text-[19px] font-semibold tracking-tight">
          Places
        </h2>
        {places === undefined ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <PlaceCardSkeleton key={i} />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="rounded-2xl bg-surface ring-1 ring-hairline">
            <EmptyState
              icon={Heart}
              title="No saved places"
              action={
                <Button asChild className="h-9 rounded-full px-4">
                  <Link href="/explore">Explore places</Link>
                </Button>
              }
            >
              Tap the heart on any place to keep it here.
            </EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {places.map((p) => (
              <PlaceCard
                key={p._id}
                place={p}
                sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw"
                meta={`${categoryLabel(p.category)} · ${cityBySlug(p.citySlug).name}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TripRow({ trip }: { trip: Doc<"itineraries"> }) {
  const rename = useMutation(api.itineraries.rename);
  const remove = useMutation(api.itineraries.remove);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(trip.title);
  const [confirm, setConfirm] = useState(false);
  const stops = trip.days.reduce((n, d) => n + d.stops.length, 0);

  async function saveTitle() {
    const next = title.trim();
    setEditing(false);
    if (!next || next === trip.title) {
      setTitle(trip.title);
      return;
    }
    try {
      await rename({ id: trip._id, title: next });
    } catch {
      setTitle(trip.title);
      toast.error("Could not rename the trip. Try again.");
    }
  }

  async function onDelete() {
    setConfirm(false);
    try {
      await remove({ id: trip._id });
      toast(`Deleted ${trip.title}`);
    } catch {
      toast.error("Could not delete the trip. Try again.");
    }
  }

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <CalendarRange className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveTitle();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setTitle(trip.title), setEditing(false))}
            aria-label="Trip name"
            className="h-9 min-w-0 flex-1 rounded-lg bg-black/[0.055] px-2.5 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-white/10"
          />
          <button type="submit" aria-label="Save name" className="press flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => (setTitle(trip.title), setEditing(false))}
            className="press flex size-8 items-center justify-center rounded-full hover:bg-accent"
          >
            <X className="size-4" aria-hidden />
          </button>
        </form>
      ) : (
        <>
          <Link href={`/saved/${trip._id}`} className="group min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium group-hover:underline">{title}</span>
            <span className="block truncate text-[13px] text-muted-foreground tabular-nums">
              {trip.days.length} {trip.days.length === 1 ? "day" : "days"} · {stops} stops
              {trip.estCostInr ? ` · about ${formatInr(trip.estCostInr)}` : ""} · saved{" "}
              {new Date(trip._creationTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Rename ${title}`}
            className="press flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label={`Delete ${title}`}
            className="press flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
          <Link href={`/saved/${trip._id}`} aria-label={`Open ${title}`} className="text-muted-foreground">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </>
      )}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogTitle>Delete this trip?</DialogTitle>
          <DialogDescription>
            &ldquo;{title}&rdquo; will be removed from your saved trips. You can plan it again any time.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="h-9 rounded-full px-4">
                Keep it
              </Button>
            </DialogClose>
            <Button variant="destructive" className="h-9 rounded-full px-4" onClick={onDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
