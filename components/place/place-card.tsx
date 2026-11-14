"use client";

import Link from "next/link";
import type { PlaceCard as PlaceCardData } from "@/convex/places";
import { categoryLabel } from "@/components/category/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PlaceImage } from "./place-image";
import { SaveButton } from "./save-button";
import { Loader2 } from "lucide-react";
import type { GeoResult } from "@/convex/geo";

/** Airbnb-style card: photo first, then the name and one line of facts. */
export function PlaceCard({
  place,
  meta,
  highlighted = false,
  onHover,
  sizes = "(min-width: 768px) 180px, 45vw",
  preload,
}: {
  place: PlaceCardData;
  meta?: string;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
  sizes?: string;
  preload?: boolean;
}) {
  return (
    <Link
      href={`/place/${place._id}`}
      onMouseEnter={() => onHover?.(place._id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(place._id)}
      onBlur={() => onHover?.(null)}
      className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative">
        <PlaceImage
          src={place.image}
          alt={place.name}
          category={place.category}
          sizes={sizes}
          preload={preload}
          className={cn(
            "transition-[box-shadow,transform] duration-200",
            highlighted && "shadow-[0_0_0_2px_var(--foreground)]",
          )}
        />
        <SaveButton placeId={place._id} name={place.name} className="absolute top-2 right-2" />
      </div>
      <div className="px-0.5 pt-2">
        <p className="truncate text-[14px] leading-5 font-medium text-foreground">{place.name}</p>
        <p className="truncate text-[13px] leading-5 text-muted-foreground tabular-nums">
          {meta ?? categoryLabel(place.category)}
        </p>
      </div>
    </Link>
  );
}

export function PlaceCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/3] rounded-2xl" />
      <Skeleton className="mt-2.5 h-3.5 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

/** The same card for a place found across India that isn't in the guide yet. */
export function GeoPlaceCard({
  result,
  meta,
  opening,
  onOpen,
}: {
  result: GeoResult;
  meta: string;
  opening: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={opening}
      className="group block w-full rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
    >
      <div className="relative">
        <PlaceImage src={undefined} alt={result.name} category={result.category} sizes="45vw" />
        {opening && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-cat-ink" aria-label="Opening" />
          </span>
        )}
      </div>
      <div className="px-0.5 pt-2">
        <p className="truncate text-[14px] leading-5 font-medium text-foreground">{result.name}</p>
        <p className="truncate text-[13px] leading-5 text-muted-foreground tabular-nums">{meta}</p>
      </div>
    </button>
  );
}
