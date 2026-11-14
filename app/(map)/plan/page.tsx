import type { Metadata } from "next";
import { PlanBuilder } from "@/components/plan/plan-builder";

export const metadata: Metadata = { title: "Plan a trip" };

export default function Page() {
  return <PlanBuilder />;
}
