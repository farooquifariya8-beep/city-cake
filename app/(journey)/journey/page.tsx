import type { Metadata } from "next";
import { Suspense } from "react";
import { Journey } from "@/components/journey/journey";

export const metadata: Metadata = { title: "Journey" };

/** Full-screen live navigation for one day of the plan. No app chrome. */
export default function Page() {
  return (
    <Suspense>
      <Journey />
    </Suspense>
  );
}
