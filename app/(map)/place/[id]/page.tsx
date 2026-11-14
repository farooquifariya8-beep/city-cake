import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceDetail } from "@/components/place/place-detail";
import { SheetSkeleton } from "@/components/map/sheet-skeleton";

export const metadata: Metadata = { title: "Place" };

export default function PlacePage() {
  return (
    <Suspense fallback={<SheetSkeleton />}>
      <PlaceDetail />
    </Suspense>
  );
}
