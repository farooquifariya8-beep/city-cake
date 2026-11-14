import { CITIES, type CitySeed } from "@/convex/lib/cities";

export type LngLat = [number, number];
export type Bounds = [LngLat, LngLat];

export const HOME_CITY = CITIES.find((c) => c.kind === "home")!;

export function cityBySlug(slug: string | null | undefined): CitySeed {
  return CITIES.find((c) => c.slug === slug) ?? HOME_CITY;
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** The bounding box of some points, or null when there are none. */
export function boundsOf(points: { lat: number; lng: number }[]): Bounds | null {
  if (points.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

export function boundsOfCoords(coords: LngLat[]): Bounds | null {
  return boundsOf(coords.map(([lng, lat]) => ({ lng, lat })));
}

/** The nearest city in the region, and how far away it is. */
export function nearestCity(lat: number, lng: number): { city: CitySeed; distanceM: number } {
  let best = HOME_CITY;
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = haversineM(lat, lng, c.lat, c.lng);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return { city: best, distanceM: bestD };
}
