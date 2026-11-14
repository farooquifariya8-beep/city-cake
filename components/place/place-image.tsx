"use client";

import Image from "next/image";
import { useState } from "react";
import { CategoryIcon } from "@/components/category/category-icon";
import { canOptimize, photoUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Every place picture sits in the same frame: fixed ratio, cover, the
 * container's radius and a hairline inner ring. Without a photo, or when it
 * fails to load, the frame shows the category tint with its icon.
 */
export function PlaceImage({
  src,
  alt,
  category,
  ratio = "4/3",
  sizes,
  width = 500,
  preload = false,
  className,
}: {
  src?: string;
  alt: string;
  category: string;
  ratio?: "4/3" | "16/9" | "1/1";
  sizes: string;
  width?: 330 | 500 | 960;
  preload?: boolean;
  className?: string;
}) {
  // 0: sized thumbnail, 1: the stored 330 px thumbnail, 2: fallback tile.
  const [attempt, setAttempt] = useState(0);
  const url = src && attempt < 2 ? photoUrl(src, attempt === 0 ? width : undefined) : null;

  return (
    <div
      data-cat={category}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-cat-soft",
        ratio === "4/3" && "aspect-[4/3]",
        ratio === "16/9" && "aspect-video",
        ratio === "1/1" && "aspect-square",
        className,
      )}
    >
      {url ? (
        <Image
          key={url}
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          unoptimized={!canOptimize(url)}
          className="object-cover"
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-cat-ink">
          <CategoryIcon category={category} className="size-[22%] max-h-12 max-w-12 opacity-70" />
        </div>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-black/5 ring-inset dark:ring-white/10" />
    </div>
  );
}
