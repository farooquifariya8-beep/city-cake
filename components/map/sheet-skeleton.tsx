import { PlaceCardSkeleton } from "@/components/place/place-card";
import { Skeleton } from "@/components/ui/skeleton";

export function SheetSkeleton() {
  return (
    <div className="px-4 pt-2 md:pt-5" aria-busy>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-2 h-7 w-3/4 rounded-lg" />
      <Skeleton className="mt-3 h-10 w-full rounded-xl" />
      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5">
        {Array.from({ length: 4 }, (_, i) => (
          <PlaceCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
