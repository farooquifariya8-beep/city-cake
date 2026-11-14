"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";

export default function MapError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      tone="error"
      title="This view could not load"
      className="py-16"
      action={
        <div className="flex gap-2">
          <Button className="h-9 rounded-full px-4" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="outline" className="h-9 rounded-full px-4">
            <Link href="/explore">Back to explore</Link>
          </Button>
        </div>
      }
    >
      The place may not exist, or the connection dropped.
    </EmptyState>
  );
}
