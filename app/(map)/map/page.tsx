import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteBuilder } from "@/components/map/route-builder";
import { SheetSkeleton } from "@/components/map/sheet-skeleton";

export const metadata: Metadata = { title: "Map and routes" };

export default function MapPage() {
  return (
    <Suspense fallback={<SheetSkeleton />}>
      <RouteBuilder />
    </Suspense>
  );
}
