"use client";

import Link from "next/link";
import { ExternalLink, Navigation } from "lucide-react";
import { dayNavigationUrls } from "@/lib/google-maps";
import type { DraftStop } from "@/lib/plan-draft";
import type { MyLocation } from "@/lib/use-my-location";

/** "Start journey" for a day in our own navigation, with Google Maps beside it. */
export function DayNavigation({ dayNumber, stops, loc }: { dayNumber: number; stops: DraftStop[]; loc: MyLocation }) {
  if (stops.length === 0) return null;
  const urls = dayNavigationUrls(loc.status === "found" ? loc : null, stops);

  return (
    <div className="mt-3 space-y-2">
      <Link
        href={`/journey?day=${dayNumber}`}
        data-testid="start-journey"
        className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--route)] text-[15px] font-medium text-white hover:brightness-110"
      >
        <Navigation className="size-[18px]" strokeWidth={2} aria-hidden />
        Start journey for day {dayNumber}
      </Link>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px]">
        {urls.map((href, i) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {urls.length > 1 ? `Google Maps, part ${i + 1}` : "Open in Google Maps"}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ))}
      </div>
    </div>
  );
}
