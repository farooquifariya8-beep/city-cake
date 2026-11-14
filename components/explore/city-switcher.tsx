"use client";

import { useQuery } from "convex/react";
import { Check, ChevronDown } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { CITIES } from "@/convex/lib/cities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cityBySlug } from "@/lib/geo";
import { cn } from "@/lib/utils";

/** The city name as a large title that opens the list of the region's towns. */
export function CitySwitcher({
  value,
  onChange,
  size = "title",
}: {
  value: string;
  onChange: (slug: string) => void;
  size?: "title" | "compact";
}) {
  const live = useQuery(api.cities.list);
  const cities = live && live.length > 0 ? live : [...CITIES].sort((a, b) => a.distanceKm - b.distanceKm);
  const current = cityBySlug(value);
  const home = cities.filter((c) => c.kind === "home");
  const trips = cities.filter((c) => c.kind === "daytrip");

  const item = (c: (typeof cities)[number]) => (
    <DropdownMenuItem
      key={c.slug}
      onSelect={() => onChange(c.slug)}
      className="items-start gap-3 rounded-xl px-2.5 py-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{c.name}</span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {c.localName}
          {"placeCount" in c && typeof c.placeCount === "number" && c.placeCount > 0
            ? ` · ${c.placeCount} places`
            : ""}
        </span>
      </span>
      {c.kind === "daytrip" && (
        <span className="pt-0.5 text-[12px] text-muted-foreground tabular-nums">
          {c.distanceKm} km
        </span>
      )}
      {c.slug === value && <Check className="mt-0.5 size-4 text-foreground" aria-hidden />}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex max-w-full items-start gap-1.5 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          size === "title" ? "large-title" : "text-[15px] font-semibold",
        )}
        aria-label={`City: ${current.name}. Change city`}
      >
        <span className="min-w-0">{current.name}</span>
        <ChevronDown
          className={cn(
            "shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180",
            size === "title" ? "mt-2 size-5" : "mt-0.5 size-4",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-80 rounded-2xl p-1.5">
        <DropdownMenuLabel className="text-muted-foreground">Home city</DropdownMenuLabel>
        {home.map(item)}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground">
          Day trips, by road from the city
        </DropdownMenuLabel>
        {trips.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
