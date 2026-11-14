"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A compact minus and plus control around a number. */
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
