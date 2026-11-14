"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PlaceImage } from "@/components/place/place-image";
import { CircleAlert, Map as MapIcon } from "lucide-react";
import type { Infer } from "convex/values";
import type { dayValidator } from "@/convex/schema";
import { CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { addMinutes, formatMinutes } from "@/lib/format";
import { cityBySlug } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type Day = Infer<typeof dayValidator>;

/** /map URL that draws one day's stops as a route. */
export function dayMapHref(day: Day): string {
  const ids = day.stops.flatMap((s) => (s.placeId ? [s.placeId] : [])).slice(0, 10);
  return `/map?city=${day.citySlug}&stops=${ids.join(",")}`;
}

/** Day-by-day timeline of a plan. */
export function ItineraryView({ days }: { days: Day[] }) {
  const ids = [...new Set(days.flatMap((d) => d.stops.flatMap((s) => (s.placeId ? [s.placeId] : []))))];
  const cards = useQuery(api.places.getMany, ids.length ? { ids: ids as Id<"places">[] } : "skip");
  const images = new Map((cards ?? []).flatMap((c) => (c.image ? [[c._id as string, c.image] as const] : [])));
  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.day} aria-labelledby={`day-${day.day}`}>
          <div className="mb-2 flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-muted-foreground">
                Day {day.day}
                {cityBySlug(day.citySlug).name !== day.title && ` · ${cityBySlug(day.citySlug).name}`}
              </p>
              <h3 id={`day-${day.day}`} className="truncate text-[19px] font-semibold tracking-tight">
                {day.title}
              </h3>
            </div>
            {day.stops.some((s) => s.placeId) && (
              <Link
                href={dayMapHref(day)}
                className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-black/[0.055] px-3 text-[13px] font-medium hover:bg-black/[0.08] dark:bg-white/10"
              >
                <MapIcon className="size-3.5" strokeWidth={2} aria-hidden />
                Show on map
              </Link>
            )}
          </div>
          <ol className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
            {day.stops.map((stop, i) => {
              const closed = stop.note?.includes("Closed on");
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-5 font-medium">{stop.name}</span>
                    <span className="block text-[13px] leading-5 text-muted-foreground tabular-nums">
                      {categoryLabel(stop.category)} · {formatMinutes(stop.durationMin)}
                    </span>
                    {stop.note && (
                      <span
                        className={cn(
                          "mt-1 flex items-start gap-1.5 text-[13px] leading-5",
                          closed ? "text-warn" : "text-muted-foreground",
                        )}
                      >
                        {closed && <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                        {stop.note}
                      </span>
                    )}
                  </span>
                </>
              );
              return (
                <li key={`${stop.name}-${i}`} className="relative">
                  {i > 0 && stop.travelMin !== undefined && stop.travelMin > 0 && (
                    <p className="ml-[124px] border-t border-hairline py-1.5 text-[12px] text-muted-foreground tabular-nums">
                      {formatMinutes(stop.travelMin)} travel, estimated
                    </p>
                  )}
                  <div
                    className={cn(
                      "flex gap-3 px-3 py-3",
                      i > 0 && !(stop.travelMin && stop.travelMin > 0) && "border-t border-hairline",
                    )}
                  >
                    <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-[13px] leading-5 tabular-nums">
                      {stop.start}
                      <span className="block text-[11px] text-muted-foreground">
                        {addMinutes(stop.start, stop.durationMin)}
                      </span>
                    </span>
                    {stop.placeId && images.get(stop.placeId) ? (
                      <PlaceImage
                        src={images.get(stop.placeId)}
                        alt=""
                        category={stop.category}
                        ratio="1/1"
                        width={330}
                        sizes="48px"
                        className="size-12 shrink-0 rounded-xl"
                      />
                    ) : (
                      <CategoryTile category={stop.category} size="md" className="size-12 rounded-xl" />
                    )}
                    {stop.placeId ? (
                      <Link href={`/place/${stop.placeId}`} className="flex min-w-0 flex-1 rounded-md hover:[&_span:first-child>span:first-child]:underline">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1">{body}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
