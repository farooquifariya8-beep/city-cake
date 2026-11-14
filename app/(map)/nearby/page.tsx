import type { Metadata } from "next";
import { Suspense } from "react";
import { NearbySheet } from "@/components/nearby/nearby-sheet";
import { SheetSkeleton } from "@/components/map/sheet-skeleton";

export const metadata: Metadata = { title: "Nearby" };

export default function NearbyPage() {
  return (
    <Suspense fallback={<SheetSkeleton />}>
      <NearbySheet />
    </Suspense>
  );
}
