"use client";

import type { ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Rarely changed options behind one button, so the sheet stays calm. */
export function FiltersPopover({
  label,
  active,
  children,
  icon = true,
  className,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
  icon?: boolean;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          active
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-hairline bg-surface text-foreground hover:bg-accent",
          className,
        )}
      >
        {icon && <SlidersHorizontal className="size-3.5" strokeWidth={2} aria-hidden />}
        {label}
        <ChevronDown className="size-3.5 opacity-60" strokeWidth={2} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80 rounded-2xl p-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}
