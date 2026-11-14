import { cacheLife } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { CITIES } from "@/convex/lib/cities";
import { photoUrl } from "@/lib/format";

export type TownCard = {
  slug: string;
  name: string;
  localName: string;
  kind: "home" | "daytrip";
  distanceKm: number;
  blurb: string;
  placeCount: number;
  facilityCount: number;
  photo?: { url: string; placeName: string; placeId: string };
};

/** Towns with counts and one real photo each. Cached for an hour. */
export async function getLandingData(): Promise<{ towns: TownCard[]; places: number; facilities: number }> {
  "use cache";
  cacheLife("hours");
  try {
    const cities = await fetchQuery(api.cities.list, {});
    const towns = await Promise.all(
      cities.map(async (c): Promise<TownCard> => {
        const top = await fetchQuery(api.places.listByCity, { citySlug: c.slug, group: "explore", limit: 40 });
        const pick = top.find((p) => p.image && p.imageKind !== "representative") ?? top.find((p) => p.image);
        return {
          slug: c.slug,
          name: c.name,
          localName: c.localName,
          kind: c.kind,
          distanceKm: c.distanceKm,
          blurb: c.blurb,
          placeCount: c.placeCount,
          facilityCount: c.facilityCount,
          photo: pick?.image ? { url: photoUrl(pick.image, 500), placeName: pick.name, placeId: pick._id } : undefined,
        };
      }),
    );
    return {
      towns,
      places: towns.reduce((n, t) => n + t.placeCount, 0),
      facilities: towns.reduce((n, t) => n + t.facilityCount, 0),
    };
  } catch {
    // Convex unreachable at build time: render the page from the seed list.
    return {
      towns: CITIES.map((c) => ({ ...c, placeCount: 0, facilityCount: 0 })),
      places: 0,
      facilities: 0,
    };
  }
}
