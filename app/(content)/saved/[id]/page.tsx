import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedTrip } from "@/components/saved/saved-trip";

export const metadata: Metadata = { title: "Saved trip" };

export default function Page() {
  return (
    <Suspense>
      <SavedTrip />
    </Suspense>
  );
}
