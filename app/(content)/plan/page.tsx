import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanPage } from "@/components/plan/plan-page";

export const metadata: Metadata = { title: "Plan a trip" };

export default function Page() {
  return (
    <Suspense>
      <PlanPage />
    </Suspense>
  );
}
