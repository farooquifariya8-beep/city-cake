/** Turn-by-turn navigation links for Google Maps. No API key; opens the app on mobile. */

type LatLng = { lat: number; lng: number };
const ll = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
const MAX_WAYPOINTS = 9;

function dirUrl(origin: LatLng | null, destination: LatLng, waypoints: LatLng[]): string {
  const q = new URLSearchParams({ api: "1" });
  if (origin) q.set("origin", ll(origin));
  q.set("destination", ll(destination));
  if (waypoints.length) q.set("waypoints", waypoints.map(ll).join("|"));
  q.set("travelmode", "driving");
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/**
 * Links covering a day's stops in order. Google takes nine waypoints, so a
 * longer day becomes several legs, each starting where the last one ended.
 * Without `origin`, Google starts from the phone's location.
 */
export function dayNavigationUrls(origin: LatLng | null, stops: LatLng[]): string[] {
  if (stops.length === 0) return [];
  const urls: string[] = [];
  let from = origin;
  let rest = stops;
  while (rest.length) {
    const leg = rest.slice(0, MAX_WAYPOINTS + 1);
    const dest = leg[leg.length - 1];
    urls.push(dirUrl(from, dest, leg.slice(0, -1)));
    from = dest;
    rest = rest.slice(leg.length);
  }
  return urls;
}

export function navigateToUrl(to: LatLng): string {
  return dirUrl(null, to, []);
}
