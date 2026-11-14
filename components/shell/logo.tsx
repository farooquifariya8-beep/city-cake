import Link from "next/link";
import { cn } from "@/lib/utils";

/** Three stacked layers, the top one in Ajanta ochre. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 20 20" className="size-[18px]" fill="none">
        <rect x="3" y="4" width="14" height="3.4" rx="1.7" fill="oklch(0.78 0.13 75)" />
        <rect x="3" y="8.8" width="14" height="3.4" rx="1.7" fill="currentColor" opacity="0.9" />
        <rect x="3" y="13.6" width="14" height="3.4" rx="1.7" fill="currentColor" opacity="0.55" />
      </svg>
    </span>
  );
}

export function Logo({ showName = true, className }: { showName?: boolean; className?: string }) {
  return (
    <Link
      href="/explore"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      aria-label="City Cake, go to explore"
    >
      <LogoMark />
      {showName && <span className="text-[15px] font-semibold tracking-tight">City Cake</span>}
    </Link>
  );
}
