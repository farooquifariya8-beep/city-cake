"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** iOS-style search field: filled, rounded, with a clear button. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl bg-black/[0.055] px-3 text-muted-foreground transition-shadow focus-within:ring-3 focus-within:ring-ring/30 dark:bg-white/10",
        className,
      )}
    >
      <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="flex size-5 items-center justify-center rounded-full bg-muted-foreground/40 text-white"
        >
          <X className="size-3" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </label>
  );
}
