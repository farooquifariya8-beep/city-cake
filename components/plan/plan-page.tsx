"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarX2, Heart, Map as MapIcon, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Infer } from "convex/values";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, EXPLORE_CATEGORIES } from "@/convex/lib/categories";
import type { prefsValidator } from "@/convex/schema";
import { CategoryChip } from "@/components/category/category-chip";
import { Segmented } from "@/components/shell/segmented";
import { EmptyState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberTicker } from "@/components/motion/number-ticker";
import { HOME_CITY } from "@/lib/geo";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { dayMapHref, ItineraryView } from "./itinerary-view";

type Prefs = Infer<typeof prefsValidator>;
const BUDGETS = ["shoestring", "comfort", "splurge"] as const;
const PACES = ["relaxed", "balanced", "packed"] as const;
const DEFAULT_INTERESTS = ["heritage", "attraction", "food"];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Preferences live in the URL, so a plan can be shared and survives sign-in. */
function readPrefs(params: URLSearchParams): Prefs {
  const days = clamp(Number(params.get("days")) || 2, 1, 5);
  const budget = (BUDGETS as readonly string[]).includes(params.get("budget") ?? "")
    ? (params.get("budget") as Prefs["budget"])
    : "comfort";
  const pace = (PACES as readonly string[]).includes(params.get("pace") ?? "")
    ? (params.get("pace") as Prefs["pace"])
    : "balanced";
  const raw = params.get("interests");
  const interests =
    raw === null
      ? DEFAULT_INTERESTS
      : raw.split(",").filter((k) => (EXPLORE_CATEGORIES as string[]).includes(k));
  const start = params.get("start");
  const date = params.get("date");
  return {
    days,
    budget,
    pace,
    interests,
    groupSize: clamp(Number(params.get("group")) || 2, 1, 12),
    startTime: start && /^\d{2}:\d{2}$/.test(start) ? start : "09:00",
    startDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    includeDayTrips: params.get("trips") !== "0",
  };
}

export function PlanPage() {
  const { params, set } = useUrlState();
  const prefs = useMemo(() => readPrefs(new URLSearchParams(params.toString())), [params]);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const save = useMutation(api.itineraries.save);
  const [saving, setSaving] = useState(false);

  const live = useQuery(api.planner.preview, { citySlug: HOME_CITY.slug, prefs });
  // Keep showing the last plan while a new one loads, so the page doesn't jump.
  const [plan, setPlan] = useState(live);
  if (live !== undefined && live !== plan) setPlan(live);
  const stale = live === undefined && plan !== undefined;

  const signInHref = useMemo(() => {
    const next = new URLSearchParams(params.toString());
    next.set("save", "1");
    return `/signin?next=${encodeURIComponent(`/plan?${next.toString()}`)}`;
  }, [params]);

  async function onSave() {
    if (!plan) return;
    if (!isAuthenticated) {
      toast("Sign in to save this plan", { description: "You'll come back to the same plan." });
      router.push(signInHref);
      return;
    }
    setSaving(true);
    try {
      await save({
        title: plan.title,
        citySlug: HOME_CITY.slug,
        prefs,
        days: plan.days,
        estCostInr: plan.estCostInr,
      });
      toast("Saved to your trips", {
        action: { label: "Open saved", onClick: () => router.push("/saved") },
      });
    } catch {
      toast.error("Could not save the plan. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Back from sign-in with ?save=1: save once, then drop the flag.
  const autoSaved = useRef(false);
  const wantsSave = params.get("save") === "1";
  useEffect(() => {
    if (!wantsSave || authLoading || !plan || autoSaved.current) return;
    autoSaved.current = true;
    set({ save: null });
    if (isAuthenticated) void Promise.resolve().then(onSave);
    // onSave reads the current plan; run once when everything is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsSave, authLoading, isAuthenticated, plan]);

  const toggleInterest = (k: string) => {
    const next = prefs.interests.includes(k)
      ? prefs.interests.filter((i) => i !== k)
      : [...prefs.interests, k];
    set({ interests: next.join(",") });
  };

  const stopCount = plan?.days.reduce((n, d) => n + d.stops.length, 0) ?? 0;

  return (
    <div className="grid gap-8 md:grid-cols-[340px_minmax(0,1fr)] md:gap-10">
      <aside className="md:sticky md:top-20 md:self-start">
        <h1 className="large-title">Plan a trip</h1>
        <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
          A day-by-day plan for {HOME_CITY.name} and its day trips, built from rules. It updates
          as you change anything.
        </p>

        <div className="mt-5 divide-y divide-hairline rounded-2xl bg-surface ring-1 ring-hairline">
          <Row label="Days">
            <Stepper value={prefs.days} min={1} max={5} onChange={(v) => set({ days: String(v) })} label="days" />
          </Row>
          <Row label="People">
            <Stepper
              value={prefs.groupSize}
              min={1}
              max={12}
              onChange={(v) => set({ group: String(v) })}
              label="people"
            />
          </Row>
          <Row label="Day trips" hint="Ellora, Ajanta and more">
            <Switch
              checked={prefs.includeDayTrips ?? true}
              onChange={(v) => set({ trips: v ? null : "0" })}
              label="Include day trips"
            />
          </Row>
        </div>
        <details className="group mt-2 rounded-2xl bg-surface ring-1 ring-hairline" open={!!prefs.startDate || prefs.startTime !== "09:00" || undefined}>
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-3.5 text-[15px] [&::-webkit-details-marker]:hidden">
            More options
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {prefs.startTime}
              {prefs.startDate ? ` · ${prefs.startDate}` : ""}
            </span>
          </summary>
          <div className="divide-y divide-hairline border-t border-hairline">
            <Row label="Start time">
              <input
                type="time"
                value={prefs.startTime}
                onChange={(e) => set({ start: e.target.value || null })}
                className="h-8 rounded-lg bg-black/[0.055] px-2 text-[14px] tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-white/10"
                aria-label="Start time each day"
              />
            </Row>
            <Row label="Start date" hint="Checks weekly closures">
              <input
                type="date"
                value={prefs.startDate ?? ""}
                onChange={(e) => set({ date: e.target.value || null })}
                className="h-8 rounded-lg bg-black/[0.055] px-2 text-[14px] tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-white/10"
                aria-label="Start date"
              />
            </Row>
          </div>
        </details>

        <Field label="Budget">
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
        </Field>
        <Field label="Pace">
          <Segmented
            label="Pace"
            value={prefs.pace}
            onChange={(v) => set({ pace: v })}
            options={[
              { value: "relaxed", label: "Relaxed", title: "3 stops a day" },
              { value: "balanced", label: "Balanced", title: "4 stops a day" },
              { value: "packed", label: "Packed", title: "6 stops a day" },
            ]}
            className="w-full"
          />
        </Field>
        <Field label="Interests">
          <div className="flex flex-wrap gap-1.5">
            {EXPLORE_CATEGORIES.map((k) => (
              <CategoryChip
                key={k}
                category={k}
                active={prefs.interests.includes(k)}
                onClick={() => toggleInterest(k)}
                label={CATEGORIES[k].label}
              />
            ))}
          </div>
        </Field>
      </aside>

      <section aria-live="polite" aria-busy={plan === undefined || stale}>
        {plan === undefined ? (
          <PlanSkeleton />
        ) : plan.days.length === 0 || stopCount === 0 ? (
          <EmptyState icon={CalendarX2} title="No stops match these choices" className="py-20">
            Pick more interests or turn on day trips.
          </EmptyState>
        ) : (
          <div className={cn("transition-opacity duration-200", stale && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-muted-foreground tabular-nums">
                  {prefs.days} {prefs.days === 1 ? "day" : "days"} · {prefs.groupSize}{" "}
                  {prefs.groupSize === 1 ? "person" : "people"} · {stopCount} stops
                </p>
                <h2 className="mt-0.5 text-[24px] leading-tight font-semibold tracking-tight">
                  {plan.title}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="h-9 rounded-full px-3.5">
                  <Link href={dayMapHref(plan.days[0])}>
                    <MapIcon strokeWidth={2} aria-hidden /> Show on map
                  </Link>
                </Button>
                <Button className="h-9 rounded-full px-3.5" onClick={onSave} disabled={saving}>
                  <Heart strokeWidth={2} aria-hidden /> {saving ? "Saving" : "Save itinerary"}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-hairline">
              <div>
                <p className="text-[13px] text-muted-foreground">Rough cost for the group</p>
                <p className="text-[22px] leading-7 font-semibold tracking-tight tabular-nums">
                  <NumberTicker value={plan.estCostInr} prefix="₹" locale="en-IN" />
                </p>
              </div>
              <p className="max-w-56 text-right text-[12px] leading-4 text-muted-foreground">
                Food, entry and local transport at {prefs.budget} prices. Stays not included. Travel
                times are straight-line estimates.
              </p>
            </div>

            <div className="mt-6">
              <ItineraryView days={plan.days} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const btn =
    "press flex size-8 items-center justify-center rounded-[8px] text-foreground disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10";
  return (
    <div className="flex items-center rounded-[10px] bg-black/[0.055] p-0.5 dark:bg-white/10">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
        <Minus className="size-4" strokeWidth={2.25} aria-hidden />
      </button>
      <span className="w-8 text-center text-[15px] font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        <Plus className="size-4" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "bg-[oklch(0.68_0.17_150)]" : "bg-black/15 dark:bg-white/20",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-200",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function PlanSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="mt-2 h-7 w-2/3 rounded-lg" />
      <Skeleton className="mt-4 h-16 rounded-2xl" />
      {[0, 1].map((d) => (
        <div key={d} className="mt-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-64 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
