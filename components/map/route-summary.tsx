"use client";

import { Car, Footprints, RotateCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { Segmented } from "@/components/shell/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance, formatMinutes } from "@/lib/format";
import type { Profile, RouteState } from "@/lib/use-route";

export const PROFILE_OPTIONS = [
  {
    value: "driving" as const,
    label: (
      <>
        <Car className="size-3.5" aria-hidden /> Drive
      </>
    ),
  },
  {
    value: "foot" as const,
    label: (
      <>
        <Footprints className="size-3.5" aria-hidden /> Walk
      </>
    ),
  },
];

/** Distance, time and mode for the route on the map. */
export function RouteSummary({
  state,
  profile,
  onProfile,
  onRetry,
  onClose,
  from,
}: {
  state: RouteState;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onRetry: () => void;
  onClose?: () => void;
  from?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-hairline">
      <div className="flex items-center gap-2">
        <Segmented
          label="Travel mode"
          value={profile}
          onChange={onProfile}
          options={PROFILE_OPTIONS}
          size="sm"
          className="flex-1"
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Clear route"
            className="press flex size-7 items-center justify-center rounded-full bg-black/[0.055] text-muted-foreground hover:text-foreground dark:bg-white/10"
          >
            <X className="size-3.5" strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-3 min-h-12" aria-live="polite">
        {state.status === "loading" || state.status === "idle" ? (
          <div>
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="mt-2 h-3.5 w-52" />
          </div>
        ) : state.status === "error" ? (
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] text-destructive">{state.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="press inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-link"
            >
              <RotateCw className="size-3.5" aria-hidden /> Retry
            </button>
          </div>
        ) : (
          <>
            <p className="text-[22px] leading-7 font-semibold tracking-tight tabular-nums">
              {formatMinutes(state.route.durationS / 60)}
              <span className="ml-2 text-[15px] font-normal text-muted-foreground">
                {formatDistance(state.route.distanceM)}
              </span>
            </p>
            {from && <p className="mt-0.5 text-[13px] text-muted-foreground">{from}</p>}
          </>
        )}
      </div>
    </div>
  );
}
