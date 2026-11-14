"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { Minus, Plus, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EXPLORE_CATEGORIES } from "@/convex/lib/categories";
import { CategoryChip } from "@/components/category/category-chip";
import { Segmented } from "@/components/shell/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatInr } from "@/lib/format";
import { HOME_CITY } from "@/lib/geo";
import type { Prefs, SavedDay } from "@/lib/plan-draft";
import { cn } from "@/lib/utils";

const DEFAULT_PREFS: Prefs = {
  days: 2,
  budget: "comfort",
  pace: "balanced",
  interests: ["heritage", "attraction", "food"],
  groupSize: 2,
  startTime: "09:00",
  includeDayTrips: true,
};

/** The rule-based planner as a starting point. Its result fills the builder. */
export function SuggestDialog({
  open,
  onOpenChange,
  initial,
  onUse,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Prefs;
  onUse: (plan: { title: string; days: SavedDay[]; estCostInr: number }, prefs: Prefs) => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(initial ?? DEFAULT_PREFS);
  const plan = usePreview(open ? prefs : null);
  const set = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const stops = plan?.days.reduce((n, d) => n + d.stops.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--route)]" aria-hidden /> Suggest a plan
        </DialogTitle>
        <DialogDescription>
          Pick a few things and we&apos;ll fill the days. You can change every stop after.
        </DialogDescription>

        <div className="divide-y divide-hairline rounded-2xl bg-surface ring-1 ring-hairline">
          <Row label="Days">
            <Stepper value={prefs.days} min={1} max={5} onChange={(v) => set({ days: v })} label="days" />
          </Row>
          <Row label="People">
            <Stepper value={prefs.groupSize} min={1} max={12} onChange={(v) => set({ groupSize: v })} label="people" />
          </Row>
          <Row label="Day trips" hint="Ellora, Ajanta and more">
            <input
              type="checkbox"
              checked={prefs.includeDayTrips ?? true}
              onChange={(e) => set({ includeDayTrips: e.target.checked })}
              className="size-5 accent-[oklch(0.68_0.17_150)]"
              aria-label="Include day trips"
            />
          </Row>
        </div>
        <Segmented
          label="Budget"
          value={prefs.budget}
          onChange={(v) => set({ budget: v })}
          options={[
            { value: "shoestring", label: "Shoestring" },
            { value: "comfort", label: "Comfort" },
            { value: "splurge", label: "Splurge" },
          ]}
          className="w-full"
        />
        <Segmented
          label="Pace"
          value={prefs.pace}
          onChange={(v) => set({ pace: v })}
          options={[
            { value: "relaxed", label: "Relaxed" },
            { value: "balanced", label: "Balanced" },
            { value: "packed", label: "Packed" },
          ]}
          className="w-full"
        />
        <div className="flex flex-wrap gap-1.5">
          {EXPLORE_CATEGORIES.map((k) => (
            <CategoryChip
              key={k}
              category={k}
              active={prefs.interests.includes(k)}
              onClick={() =>
                set({
                  interests: prefs.interests.includes(k)
                    ? prefs.interests.filter((i) => i !== k)
                    : [...prefs.interests, k],
                })
              }
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3 ring-1 ring-hairline" aria-live="polite">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{plan ? plan.title : "Working it out"}</p>
            <p className="text-[13px] text-muted-foreground tabular-nums">
              {plan ? `${stops} stops · about ${formatInr(plan.estCostInr)} for the group` : " "}
            </p>
          </div>
          <Button
            className="h-9 shrink-0 rounded-full px-4"
            disabled={!plan || stops === 0}
            onClick={() => plan && onUse(plan, prefs)}
          >
            Use this plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function usePreview(prefs: Prefs | null) {
  return useQuery(api.planner.preview, prefs ? { citySlug: HOME_CITY.slug, prefs } : "skip");
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2">
      <span>
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
  size = "md",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
  size?: "sm" | "md";
}) {
  const btn = cn(
    "press flex items-center justify-center rounded-[8px] text-foreground disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10",
    size === "md" ? "size-8" : "size-6",
  );
  return (
    <div className="flex items-center rounded-[10px] bg-black/[0.055] p-0.5 dark:bg-white/10">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label={`Less ${label}`}>
        <Minus className={size === "md" ? "size-4" : "size-3"} strokeWidth={2.25} aria-hidden />
      </button>
      <span className={cn("text-center font-medium tabular-nums", size === "md" ? "w-8 text-[15px]" : "min-w-12 text-[12px]")}>
        {format ? format(value) : value}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label={`More ${label}`}>
        <Plus className={size === "md" ? "size-4" : "size-3"} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
