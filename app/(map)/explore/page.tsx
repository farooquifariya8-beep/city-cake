import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreSheet } from "@/components/explore/explore-sheet";
import { SheetSkeleton } from "@/components/map/sheet-skeleton";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <Suspense fallback={<SheetSkeleton />}>
      <ExploreSheet />
    </Suspense>
  );
}
