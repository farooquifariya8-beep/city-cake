"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Merge,
  Navigation,
  RotateCw,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { formatToTurn, instruction, maneuverIcon, type ManeuverIcon, type NavStep } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<ManeuverIcon, LucideIcon> = {
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  "slight-left": ArrowUpLeft,
  "slight-right": ArrowUpRight,
  "sharp-left": ArrowLeft,
  "sharp-right": ArrowRight,
  uturn: Undo2,
  roundabout: RotateCw,
  merge: Merge,
  arrive: Flag,
  depart: Navigation,
};

export function ManeuverGlyph({ step, className }: { step: NavStep; className?: string }) {
  const Icon = ICONS[maneuverIcon(step)];
  return <Icon className={className} strokeWidth={2.25} aria-hidden />;
}

/** The card at the top of the drive, in the primary colour. Every state of the drive uses it. */
export function BannerShell({ children, below }: { children: ReactNode; below?: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="overflow-hidden rounded-[24px] bg-primary text-primary-foreground"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      <div className="flex min-h-[84px] items-center gap-3.5 px-4 py-3.5">{children}</div>
      {below}
    </div>
  );
}

export function BannerIcon({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" }) {
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-2xl",
        tone === "good" ? "bg-positive text-white" : tone === "warn" ? "bg-warning text-white" : "bg-primary-foreground/10",
      )}
    >
      {children}
    </span>
  );
}

export function BannerText({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[19px] leading-tight font-semibold tracking-[-0.01em] text-balance">{title}</p>
        {body && <p className="mt-0.5 text-[14px] leading-snug text-primary-foreground/70">{body}</p>}
      </div>
      {action}
    </>
  );
}

/** Next turn: how far, what to do, onto which road, and the turn after when it is close. */
export function ManeuverBanner({
  step,
  toM,
  then,
  stopName,
  rerouting,
}: {
  step: NavStep;
  toM: number;
  then: NavStep | null;
  stopName?: string;
  rerouting?: boolean;
}) {
  const text = instruction(step, stopName);
  return (
    <BannerShell
      below={
        (then || rerouting) && (
          <div className="flex items-center gap-2 border-t border-primary-foreground/10 px-4 py-2 text-[14px] text-primary-foreground/75">
            {rerouting ? (
              <span>Finding a new route</span>
            ) : (
              then && (
                <>
                  <span>Then</span>
                  <ManeuverGlyph step={then} className="size-4" />
                  <span className="truncate">{instruction(then)}</span>
                </>
              )
            )}
          </div>
        )
      }
    >
      <span className="flex w-14 shrink-0 flex-col items-center">
        <ManeuverGlyph step={step} className="size-10" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{formatToTurn(toM)}</p>
        <p className="mt-1.5 line-clamp-2 text-[17px] leading-snug font-medium text-primary-foreground/90">{text}</p>
      </div>
    </BannerShell>
  );
}
