"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronUp, CircleCheck, ExternalLink, Navigation, Route, SkipForward } from "lucide-react";
import { EASE_OUT } from "@/lib/ease";
import { formatDistance, formatMinutes } from "@/lib/format";
import type { DraftStop } from "@/lib/plan-draft";
import { cn } from "@/lib/utils";

const clock = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
export const formatClock = (ms: number) => clock.format(ms);

export type Stats = { arrival: number | null; remainingS: number; remainingM: number; live: boolean };
export type NextStop = { index: number; stop: DraftStop; distanceM: number | null; seconds: number | null };

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="shrink-0">
      <span className="block text-[19px] leading-tight font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums">{value}</span>
      <span className="block text-[12px] text-muted-foreground">{label}</span>
    </span>
  );
}

export function SpeedBadge({ kmh }: { kmh: number }) {
  return (
    <div className="material flex size-[60px] flex-col items-center justify-center rounded-full" aria-label={`Speed ${kmh} kilometres per hour`}>
      <span className="text-[21px] leading-none font-semibold tabular-nums">{kmh}</span>
      <span className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">km/h</span>
    </div>
  );
}

export function FollowButton({ follow, onFollow, onOverview }: { follow: boolean; onFollow: () => void; onOverview: () => void }) {
  return follow ? (
    <button
      type="button"
      onClick={onOverview}
      aria-label="Show the whole route"
      title="Overview"
      className="material press flex size-11 items-center justify-center rounded-full"
    >
      <Route className="size-[18px]" strokeWidth={2} aria-hidden />
    </button>
  ) : (
    <button
      type="button"
      onClick={onFollow}
      className="material press inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-[var(--route)]"
    >
      <Navigation className="size-4" strokeWidth={2} aria-hidden />
      Re-centre
    </button>
  );
}

/** The bottom card: arrival, time and distance left, End, and the day's stops when opened. */
export function JourneyPanel({
  dayNumber,
  stats,
  next,
  stops,
  reached,
  open,
  onToggle,
  onEnd,
  onSkip,
  googleUrl,
}: {
  dayNumber: number;
  stats: Stats | null;
  next: NextStop | null;
  stops: DraftStop[];
  reached: number;
  open: boolean;
  onToggle: () => void;
  onEnd: () => void;
  onSkip: () => void;
  googleUrl: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="material overflow-hidden rounded-[24px]">
      <div className="flex items-center gap-2 p-2 pl-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="journey-details"
          className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden rounded-xl py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          {stats ? (
            <>
              <Stat value={stats.live && stats.arrival ? formatClock(stats.arrival) : formatMinutes(stats.remainingS / 60)} label={stats.live ? "arrival" : "drive"} />
              {stats.live && <Stat value={formatMinutes(stats.remainingS / 60)} label="left" />}
              <Stat value={formatDistance(stats.remainingM)} label={stats.live ? "to go" : "by road"} />
            </>
          ) : (
            <span className="block py-1">
              <span className="block h-5 w-36 rounded-md bg-black/[0.06] dark:bg-white/10" />
              <span className="mt-1.5 block h-3 w-20 rounded bg-black/[0.05] dark:bg-white/10" />
            </span>
          )}
          <ChevronUp
            className={cn("ml-auto size-5 shrink-0 text-muted-foreground transition-transform duration-200", !open && "rotate-180")}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="press h-11 shrink-0 rounded-full bg-destructive px-4 text-[15px] font-semibold text-white hover:brightness-110"
        >
          End
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="journey-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="max-h-[52dvh] overflow-y-auto border-t border-hairline px-4 pt-3 pb-4">
              {next && (
                <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-hairline">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--route)] text-[13px] font-semibold text-white tabular-nums">
                    {next.index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-muted-foreground">Next stop</span>
                    <span className="block truncate text-[15px] font-medium">{next.stop.name}</span>
                    {next.distanceM !== null && (
                      <span className="block text-[13px] text-muted-foreground tabular-nums">
                        {formatDistance(next.distanceM)}
                        {next.seconds !== null ? ` · ${formatMinutes(Math.max(1, next.seconds / 60))}` : ""}
                      </span>
                    )}
                  </span>
                  {next.index < stops.length - 1 && (
                    <button
                      type="button"
                      onClick={onSkip}
                      className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-black/[0.055] px-3 text-[13px] font-medium hover:bg-black/10 dark:bg-white/10"
                    >
                      <SkipForward className="size-3.5" aria-hidden />
                      Skip
                    </button>
                  )}
                </div>
              )}

              <h2 className="mt-4 px-1 text-[13px] font-semibold text-muted-foreground">Day {dayNumber}</h2>
              <ol className="mt-1.5 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
                {stops.map((s, i) => {
                  const done = i < reached;
                  const isNext = i === reached;
                  return (
                    <li key={s.key} className="flex items-center gap-3 px-3 py-2.5">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums",
                          done ? "bg-black/[0.07] text-muted-foreground dark:bg-white/10" : "bg-[var(--route)] text-white",
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={2.5} aria-label="Done" /> : i + 1}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate text-[14px]", done && "text-muted-foreground line-through decoration-1")}>
                        {s.name}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">{isNext ? "Next" : s.start}</span>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/plan"
                  className="press flex h-11 items-center justify-center rounded-full bg-black/[0.055] text-[14px] font-medium hover:bg-black/10 dark:bg-white/10"
                >
                  Back to the plan
                </Link>
                {googleUrl ? (
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="press flex h-11 items-center justify-center gap-1.5 rounded-full bg-black/[0.055] text-[14px] font-medium hover:bg-black/10 dark:bg-white/10"
                  >
                    Google Maps
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  <span />
                )}
              </div>
              <p className="mt-3 text-center text-[12px] text-muted-foreground">
                Times come from OpenStreetMap road speeds. Watch the road, not the screen.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The day is driven: every stop reached. */
export function DonePanel({ dayNumber, count }: { dayNumber: number; count: number }) {
  return (
    <div className="material rounded-[24px] p-5 text-center">
      <CircleCheck className="mx-auto size-10 text-positive" strokeWidth={1.75} aria-hidden />
      <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Day {dayNumber} done</h2>
      <p className="mt-1 text-[14px] text-muted-foreground">
        You reached {count === 1 ? "the stop" : `all ${count} stops`}.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/plan" className="press flex h-11 items-center justify-center rounded-full bg-[var(--route)] text-[14px] font-medium text-white">
          Back to the plan
        </Link>
        <Link
          href="/nearby"
          className="press flex h-11 items-center justify-center rounded-full bg-black/[0.055] text-[14px] font-medium hover:bg-black/10 dark:bg-white/10"
        >
          What&apos;s nearby
        </Link>
      </div>
    </div>
  );
}
