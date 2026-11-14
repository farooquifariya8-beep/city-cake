"use client";

import { cn } from "@/lib/utils";
import { CategoryIcon, categoryLabel } from "./category-icon";

/** A filter chip. Active chips take the category's colour. */
export function CategoryChip({
  category,
  active,
  onClick,
  label,
}: {
  category?: string;
  active: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      data-cat={category}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? category
            ? "border-transparent bg-cat text-cat-on"
            : "border-transparent bg-primary text-primary-foreground"
          : "border-hairline bg-surface text-foreground hover:bg-accent",
      )}
    >
      {category && (
        <CategoryIcon
          category={category}
          className={cn("size-3.5", !active && "text-cat-ink")}
        />
      )}
      {label ?? (category ? categoryLabel(category) : "All")}
    </button>
  );
}

/** Small rounded tile with the category icon, for list rows. */
export function CategoryTile({
  category,
  className,
  size = "md",
}: {
  category: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      data-cat={category}
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-cat-soft text-cat-ink",
        size === "sm" && "size-7 rounded-lg",
        size === "md" && "size-10 rounded-xl",
        size === "lg" && "size-12 rounded-2xl",
        className,
      )}
    >
      <CategoryIcon
        category={category}
        className={size === "sm" ? "size-3.5" : size === "md" ? "size-[18px]" : "size-5"}
      />
    </span>
  );
}
