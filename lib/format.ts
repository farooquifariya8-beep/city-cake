/** "850 m" under a kilometre, "2.4 km" above. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** "45 min", "1 h 20 min". */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export function formatInr(n: number): string {
  return inr.format(n);
}

/** "09:30" plus minutes, as "11:00". */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Wikipedia thumbnails are stored at 330 px with tracking query strings.
 * Wikimedia serves a fixed set of widths, so ask for one of those.
 */
export function photoUrl(url: string, width?: 330 | 500 | 960): string {
  const clean = url.split("?")[0];
  if (clean.includes("/wiki/Special:FilePath/")) return width ? `${clean}?width=${width}` : clean;
  if (!width) return clean;
  return clean.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`);
}

/** Only same-site paths are safe to redirect to after sign-in. */
export function safeNext(next: string | null | undefined, fallback = "/explore"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

/** Trim text at a word boundary. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

const OPTIMIZED_HOSTS = new Set(["thumb.wikimedia.org", "upload.wikimedia.org", "commons.wikimedia.org"]);

/** Hosts next.config.ts lets the image optimizer fetch. Others load as they are. */
export function canOptimize(url: string): boolean {
  try {
    return OPTIMIZED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
