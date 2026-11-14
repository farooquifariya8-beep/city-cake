"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import {
  ChevronLeft,
  Clock,
  Globe,
  Heart,
  MapPin,
  MapPinOff,
  Navigation,
  Phone,
  Plus,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EXPLORE_CATEGORIES, FACILITY_CATEGORIES } from "@/convex/lib/categories";
import { CategoryTile } from "@/components/category/category-chip";
import { categoryLabel } from "@/components/category/category-icon";
import { toMapPoint, useHighlight, useMapActions, useMapScene, type Scene } from "@/components/map/map-store";
import { RouteSummary } from "@/components/map/route-summary";
import { useSheet } from "@/components/map/sheet";
import { EmptyState, Group } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "@/lib/format";
import { photoFirst } from "@/lib/photo-first";
import { boundsOfCoords, cityBySlug } from "@/lib/geo";
import { useOrigin } from "@/lib/use-origin";
import { useRoute, type Profile } from "@/lib/use-route";
import { cn } from "@/lib/utils";
import { PlaceCard } from "./place-card";
import { PlaceImage } from "./place-image";
import { PlaceRow, PlaceRowSkeleton } from "./place-row";
import { useSavePlace } from "./save-button";

export function PlaceDetail() {
  const { id } = useParams<{ id: string }>();
  const place = useQuery(api.places.get, { id: id as Id<"places"> });

  if (place === undefined) return <DetailSkeleton />;
  if (place === null) {
    return (
      <EmptyState
        icon={MapPinOff}
        title="This place isn't in the guide"
        className="py-16"
        action={
          <Button asChild className="h-9 rounded-full px-4">
            <Link href="/explore">Back to explore</Link>
          </Button>
        }
      >
        It may have been removed from OpenStreetMap since the last update.
      </EmptyState>
    );
  }
  return <Detail key={place._id} place={place} />;
}

function Detail({ place }: { place: Doc<"places"> }) {
  const router = useRouter();
  const city = cityBySlug(place.citySlug);
  const { saved, onToggle } = useSavePlace(place._id, place.name);
  const { origin, locate } = useOrigin(city);
  const route = useRoute();
  const [profile, setProfile] = useState<Profile>("driving");
  const [directions, setDirections] = useState(false);
  const { snapTo } = useSheet();
  const highlight = useHighlight();
  const { setHighlight } = useMapActions();

  const facilities = useQuery(api.places.nearby, {
    lat: place.lat,
    lng: place.lng,
    categories: [...FACILITY_CATEGORIES],
    radiusM: 2000,
    limit: 8,
  });
  const sights = useQuery(api.places.nearby, {
    lat: place.lat,
    lng: place.lng,
    categories: [...EXPLORE_CATEGORIES],
    radiusM: 3000,
    limit: 9,
  });
  const nearbySights = useMemo(
    () => (sights ? photoFirst(sights.filter((s) => s._id !== place._id), 9).slice(0, 8) : undefined),
    [sights, place._id],
  );

  const startDirections = useCallback(
    async (p: Profile) => {
      setDirections(true);
      snapTo("half");
      const from = await locate();
      route.run([{ lat: from.lat, lng: from.lng }, { lat: place.lat, lng: place.lng }], p);
    },
    [locate, route, place.lat, place.lng, snapTo],
  );

  const routeCoords = route.state.status === "ready" ? route.state.route.coordinates : null;

  const scene = useMemo<Scene>(() => {
    const point = toMapPoint(place);
    const others = [...(facilities ?? []), ...(nearbySights ?? [])].map(toMapPoint);
    return {
      points: others,
      selected: point,
      route: directions ? routeCoords : null,
      origin:
        directions && origin.status !== "idle" && origin.status !== "locating"
          ? { lat: origin.lat, lng: origin.lng, kind: origin.status === "user" ? "user" : "centre" }
          : null,
      camera:
        directions && routeCoords
          ? { key: `route:${place._id}:${profile}:${routeCoords.length}`, bounds: boundsOfCoords(routeCoords) }
          : { key: `place:${place._id}`, center: [place.lng, place.lat], zoom: 15.5 },
    };
  }, [place, facilities, nearbySights, directions, routeCoords, origin, profile]);
  useMapScene(scene);

  const facts: { icon: LucideIcon; label: string; value: React.ReactNode }[] = [];
  if (place.openingHours)
    facts.push({ icon: Clock, label: "Hours", value: place.openingHours.replaceAll(";", ", ") });
  if (place.address) facts.push({ icon: MapPin, label: "Address", value: place.address });
  if (place.cuisine)
    facts.push({ icon: UtensilsCrossed, label: "Cuisine", value: place.cuisine.replaceAll(";", ", ").replaceAll("_", " ") });
  if (place.phone)
    facts.push({
      icon: Phone,
      label: "Phone",
      value: (
        <a href={`tel:${place.phone.split(";")[0]}`} className="text-link">
          {place.phone.split(";")[0]}
        </a>
      ),
    });
  if (place.website)
    facts.push({
      icon: Globe,
      label: "Website",
      value: (
        <a href={place.website} target="_blank" rel="noreferrer" className="break-all text-link">
          {place.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        </a>
      ),
    });

  const wiki = place.wikipedia?.split(":");
  const wikiUrl = wiki && wiki.length > 1 ? `https://${wiki[0]}.wikipedia.org/wiki/${encodeURIComponent(wiki.slice(1).join(":"))}` : null;

  return (
    <article className="px-4 pt-2 md:pt-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/explore"))}
          className="press -ml-1 inline-flex h-8 items-center gap-0.5 rounded-full pr-3 pl-1.5 text-[15px] font-medium text-link hover:bg-accent"
        >
          <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
          Back
        </button>
        <span className="text-[13px] text-muted-foreground">{city.name}</span>
      </div>

      {place.image && (
        <PlaceImage
          src={place.image}
          alt={place.name}
          category={place.category}
          ratio="16/9"
          width={960}
          sizes="(min-width: 768px) 368px, 92vw"
          preload
        />
      )}
      {place.image && (place as { imageKind?: string }).imageKind === "representative" && (
        <p className="mt-1.5 px-1 text-[12px] text-muted-foreground">Similar place, not this exact one</p>
      )}

      <div className={cn("flex items-center gap-2", place.image ? "mt-4" : "mt-1")}>
        <CategoryTile category={place.category} size="sm" />
        <span data-cat={place.category} className="text-[13px] font-medium text-cat-ink">
          {categoryLabel(place.category)}
        </span>
      </div>
      <h1 className="large-title mt-1.5">{place.name}</h1>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ActionButton
          icon={Navigation}
          label="Directions"
          primary
          onClick={() => startDirections(profile)}
        />
        <ActionButton
          icon={Heart}
          label={saved ? "Saved" : "Save"}
          onClick={onToggle}
          pressed={saved}
          iconClass={saved ? "fill-heart text-heart" : undefined}
        />
        <ActionButton
          icon={Plus}
          label="Add to route"
          onClick={() => router.push(`/map?city=${place.citySlug}&stops=${place._id}`)}
        />
      </div>

      {directions && (
        <div className="mt-3">
          <RouteSummary
            state={origin.status === "locating" ? { status: "loading" } : route.state}
            profile={profile}
            onProfile={(p) => {
              setProfile(p);
              startDirections(p);
            }}
            onRetry={() => startDirections(profile)}
            onClose={() => {
              setDirections(false);
              route.clear();
            }}
            from={
              origin.status === "user"
                ? "From your location"
                : `From the centre of ${city.name}. ${origin.reason ?? ""}`
            }
          />
        </div>
      )}

      {place.summary && (
        <section className="mt-5">
          <p className="text-[15px] leading-6 text-foreground/90">{place.summary}</p>
          {wikiUrl && (
            <a
              href={wikiUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[13px] text-muted-foreground hover:text-foreground"
            >
              From Wikipedia
            </a>
          )}
        </section>
      )}

      {facts.length > 0 && (
        <Group title="Details" className="mt-5">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-3 px-3 py-2.5">
              <f.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0">
                <p className="text-[12px] text-muted-foreground">{f.label}</p>
                <p className="text-[14px] leading-5">{f.value}</p>
              </div>
            </div>
          ))}
        </Group>
      )}

      <Group title="Facilities within 2 km" className="mt-5">
        {facilities === undefined ? (
          Array.from({ length: 3 }, (_, i) => <PlaceRowSkeleton key={i} />)
        ) : facilities.length === 0 ? (
          <p className="px-3 py-3 text-[14px] text-muted-foreground">
            No hospitals, pharmacies, ATMs or transport are mapped within 2 km.
          </p>
        ) : (
          facilities.map((f) => (
            <PlaceRow
              key={f._id}
              id={f._id}
              name={f.name}
              category={f.category}
              image={f.image}
              highlighted={highlight === f._id}
              onHover={setHighlight}
              trailing={
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {formatDistance(f.distanceM)}
                </span>
              }
            />
          ))
        )}
      </Group>
      <Link
        href={`/nearby?lat=${place.lat.toFixed(5)}&lng=${place.lng.toFixed(5)}&from=${encodeURIComponent(place.name)}`}
        className="mt-2 inline-block px-1 text-[13px] font-medium text-link"
      >
        All facilities around here
      </Link>

      {nearbySights && nearbySights.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">
            More to see within 3 km
          </h2>
          <div className="fade-x -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {nearbySights.map((s) => (
              <div key={s._id} className="w-40 shrink-0 snap-start">
                <PlaceCard
                  place={s}
                  sizes="160px"
                  meta={`${categoryLabel(s.category)} · ${formatDistance(s.distanceM)}`}
                  highlighted={highlight === s._id}
                  onHover={setHighlight}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
  pressed,
  iconClass,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
  pressed?: boolean;
  iconClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "press flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[12px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        primary
          ? "bg-[var(--route)] text-white hover:brightness-110"
          : "bg-black/[0.055] text-foreground hover:bg-black/[0.08] dark:bg-white/10 dark:hover:bg-white/15",
      )}
    >
      <Icon className={cn("size-[18px]", iconClass)} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="px-4 pt-2 md:pt-4" aria-busy>
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="mt-3 aspect-video rounded-2xl" />
      <Skeleton className="mt-4 h-4 w-24" />
      <Skeleton className="mt-2 h-7 w-3/4 rounded-lg" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton className="mt-5 h-24 rounded-2xl" />
    </div>
  );
}
