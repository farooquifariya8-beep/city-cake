"use client";

import Image from "next/image";
import { MapMarker, MarkerContent } from "@/components/ui/map";
import { photoUrl } from "@/lib/format";
import { CategoryIcon } from "@/components/category/category-icon";
import { cn } from "@/lib/utils";
import type { MapPoint, Origin } from "./map-store";

function Thumb({ point, size }: { point: MapPoint; size: number }) {
  if (!point.image) return null;
  return (
    <Image
      src={photoUrl(point.image, 330)}
      alt=""
      width={size}
      height={size}
      className="size-full object-cover"
    />
  );
}

/** The selected place: a photo bubble (or icon) in the category colour, name below. */
export function SelectedPin({ point }: { point: MapPoint }) {
  return (
    <MapMarker longitude={point.lng} latitude={point.lat} anchor="bottom">
      <MarkerContent>
        <div data-cat={point.category} className="flex flex-col items-center">
          <span className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl border-[3px] border-white bg-cat text-cat-on shadow-[0_6px_18px_rgb(0_0_0/0.28)]">
            {point.image ? (
              <Thumb point={point} size={112} />
            ) : (
              <CategoryIcon category={point.category} className="size-6" strokeWidth={2} />
            )}
          </span>
          {point.image && (
            <span className="-mt-3 ml-10 flex size-6 items-center justify-center rounded-full border-2 border-white bg-cat text-cat-on shadow-sm">
              <CategoryIcon category={point.category} className="size-3" strokeWidth={2.25} />
            </span>
          )}
          <span className={cn("size-2.5 rotate-45 rounded-[2px] bg-white shadow-sm", point.image ? "-mt-2" : "-mt-1.5")} />
          <span className="mt-1 max-w-44 truncate rounded-full bg-white/95 px-2 py-0.5 text-[12px] font-semibold text-neutral-900 shadow-sm">
            {point.name}
          </span>
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

/** A hovered place: a label bubble, with a thumbnail when there is a photo. */
export function HoverPin({ point }: { point: MapPoint }) {
  return (
    <MapMarker longitude={point.lng} latitude={point.lat} anchor="bottom" offset={[0, -12]}>
      <MarkerContent className="pointer-events-none">
        <div
          data-cat={point.category}
          className="flex items-center gap-1.5 rounded-full bg-white py-1 pr-2.5 pl-1 text-[12px] font-semibold text-neutral-900 shadow-[0_4px_14px_rgb(0_0_0/0.18)]"
        >
          <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-cat text-cat-on">
            {point.image ? (
              <Thumb point={point} size={48} />
            ) : (
              <CategoryIcon category={point.category} className="size-3" strokeWidth={2} />
            )}
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
