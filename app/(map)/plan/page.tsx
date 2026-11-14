import type { Metadata } from "next";
import { PlanFlow } from "@/components/plan/plan-flow";

export const metadata: Metadata = { title: "Plan a trip" };

export default function Page() {
  return <PlanFlow />;
}
