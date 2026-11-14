"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";

export default function ContentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      tone="error"
      title="This page could not load"
      className="py-24"
      action={
        <Button className="h-9 rounded-full px-4" onClick={reset}>
          Try again
        </Button>
      }
    >
      The connection may have dropped. Your saved places are safe.
    </EmptyState>
  );
}
