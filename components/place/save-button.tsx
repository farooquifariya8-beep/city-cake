"use client";

import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

/** Saved state of a place plus a toggle that handles the signed-out path. */
export function useSavePlace(placeId: Id<"places">, name: string) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ids = useQuery(api.favorites.ids, isAuthenticated ? {} : "skip");
  const router = useRouter();
  const toggle = useMutation(api.favorites.toggle).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.favorites.ids, {});
    if (!current) return;
    store.setQuery(
      api.favorites.ids,
      {},
      current.includes(args.placeId)
        ? current.filter((id) => id !== args.placeId)
        : [...current, args.placeId],
    );
  });

  const saved = ids?.includes(placeId) ?? false;

  async function onToggle() {
    if (isLoading) return;
    if (!isAuthenticated) {
      toast("Sign in again to save places");
      router.push("/signin");
      return;
    }
    try {
      const nowSaved = await toggle({ placeId });
      toast(nowSaved ? `Saved ${name}` : `Removed ${name} from saved`);
    } catch {
      toast.error("Could not update your saved places. Try again.");
    }
  }

  return { saved, onToggle };
}

/** Round heart button that floats on a photo. */
export function SaveButton({
  placeId,
  name,
  className,
}: {
  placeId: Id<"places">;
  name: string;
  className?: string;
}) {
  const { saved, onToggle } = useSavePlace(placeId, name);
  const label = saved ? `Remove ${name} from saved` : `Save ${name}`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        "press inline-flex size-8 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-sm backdrop-blur outline-none hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Heart
        strokeWidth={2}
        className={cn("size-4 transition-colors", saved && "fill-heart text-heart")}
        aria-hidden
      />
    </button>
  );
}
