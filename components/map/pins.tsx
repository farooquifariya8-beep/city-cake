"use client";

import { MapMarker, MarkerContent } from "@/components/ui/map";
import { CategoryIcon } from "@/components/category/category-icon";
import { cn } from "@/lib/utils";
import type { MapPoint, Origin } from "./map-store";

/** The selected place: a round pin in the category colour with its name below. */
export function SelectedPin({ point }: { point: MapPoint }) {
  return (
    <MapMarker longitude={point.lng} latitude={point.lat} anchor="bottom">
      <MarkerContent>
        <div data-cat={point.category} className="flex flex-col items-center">
          <span className="flex size-10 items-center justify-center rounded-full border-[2.5px] border-white bg-cat text-cat-on shadow-[0_4px_14px_rgb(0_0_0/0.25)]">
            <CategoryIcon category={point.category} className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="-mt-1 size-2.5 rotate-45 rounded-[2px] bg-white shadow-sm" />
          <span className="mt-1 max-w-40 truncate rounded-full bg-white/90 px-2 py-0.5 text-[12px] font-semibold text-neutral-900 shadow-sm">
            {point.name}
          </span>
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

/** A hovered place: a label bubble over its dot. */
export function HoverPin({ point }: { point: MapPoint }) {
  return (
    <MapMarker longitude={point.lng} latitude={point.lat} anchor="bottom" offset={[0, -8]}>
      <MarkerContent className="pointer-events-none">
        <div
          data-cat={point.category}
          className="flex items-center gap-1.5 rounded-full bg-white py-1 pr-2.5 pl-1 text-[12px] font-semibold text-neutral-900 shadow-[0_4px_14px_rgb(0_0_0/0.18)]"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-cat text-cat-on">
            <CategoryIcon category={point.category} className="size-3" strokeWidth={2} />
          </span>
          <span className="max-w-44 truncate">{point.name}</span>
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

/** A numbered route stop. */
export function StopPin({
  point,
  index,
  onClick,
}: {
  point: MapPoint;
  index: number;
  onClick?: () => void;
}) {
  return (
    <MapMarker longitude={point.lng} latitude={point.lat} onClick={onClick}>
      <MarkerContent>
        <span
          title={point.name}
          className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-[var(--route)] text-[12px] font-semibold text-white tabular-nums shadow-[0_2px_8px_rgb(0_0_0/0.25)]"
        >
          {index + 1}
        </span>
      </MarkerContent>
    </MapMarker>
  );
}

/** Where routes start: the visitor, or the city centre when location is off. */
export function OriginPin({ origin }: { origin: Origin }) {
  return (
    <MapMarker longitude={origin.lng} latitude={origin.lat}>
      <MarkerContent className="pointer-events-none">
        <span
          title={origin.kind === "user" ? "You are here" : "City centre"}
          className={cn(
            "relative flex size-[18px] items-center justify-center rounded-full border-[3px] border-white shadow-[0_0_0_6px_rgb(47_111_222/0.18),0_2px_6px_rgb(0_0_0/0.3)]",
            origin.kind === "user" ? "bg-[#2f6fde]" : "bg-neutral-700",
          )}
        />
      </MarkerContent>
    </MapMarker>
  );
}
