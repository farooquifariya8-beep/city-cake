"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A grouped-list row: category tile, name, a line of facts, and a trailing slot. */
export function PlaceRow({
  id,
  name,
  category,
  detail,
  trailing,
  highlighted,
  onHover,
}: {
  id: string;
  name: string;
  category: string;
  detail?: string;
  trailing?: ReactNode;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors duration-150",
        highlighted && "bg-accent",
      )}
    >
      <Link
        href={`/place/${id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CategoryTile category={category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-5 font-medium">{name}</span>
          <span className="block truncate text-[13px] leading-5 text-muted-foreground">
            {detail ?? categoryLabel(category)}
          </span>
        </span>
      </Link>
      {trailing}
    </div>
  );
}

export function PlaceRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-10 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
    </div>
  );
}
