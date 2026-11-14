"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { CalendarX2, ChevronLeft, Map as MapIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { dayMapHref, ItineraryView } from "@/components/plan/itinerary-view";
import { EmptyState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInr } from "@/lib/format";

/** A saved itinerary, as it was when saved. */
export function SavedTrip() {
  const { id } = useParams<{ id: string }>();
  const trip = useQuery(api.itineraries.get, { id: id as Id<"itineraries"> });

  if (trip === undefined) {
    return (
      <div aria-busy>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-8 w-2/3 rounded-lg" />
        <Skeleton className="mt-6 h-72 rounded-2xl" />
      </div>
    );
  }
  if (trip === null) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="This trip isn't in your saved trips"
        className="py-20"
        action={
          <Button asChild className="h-9 rounded-full px-4">
            <Link href="/saved">Back to saved</Link>
          </Button>
        }
      >
        It may have been deleted, or it belongs to another account.
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/saved" className="-ml-1 inline-flex items-center gap-0.5 text-[15px] font-medium text-link">
        <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
        Saved
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="large-title">{trip.title}</h1>
          <p className="mt-1 text-[14px] text-muted-foreground tabular-nums">
            {trip.prefs.groupSize} {trip.prefs.groupSize === 1 ? "person" : "people"} · {trip.prefs.budget}
            {trip.estCostInr ? ` · about ${formatInr(trip.estCostInr)} for the group` : ""}
          </p>
        </div>
        {trip.days[0] && (
          <Button asChild variant="outline" className="h-9 rounded-full px-3.5">
            <Link href={dayMapHref(trip.days[0])}>
              <MapIcon strokeWidth={2} aria-hidden /> Show on map
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-6">
        <ItineraryView days={trip.days} />
      </div>
    </div>
  );
}
