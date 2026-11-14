// OSM tag -> category mapping, scoring and dedupe. Pure: no Convex imports
// beyond shared libs, no network. The mapping follows the table in docs/data.md.

import { CATEGORIES, type Category, type CategoryGroup } from "./categories";
import { isLandmark, LANDMARK_BONUS, normalizeName } from "./landmarks";

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** A place row as ingest writes it, before Convex adds _id, image and summary. */
export type PlaceRow = {
  osmId: string;
  citySlug: string;
  name: string;
  category: Category;
  group: CategoryGroup;
  lat: number;
  lng: number;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  cuisine?: string;
  description?: string;
  wikipedia?: string;
  wikidata?: string;
  score: number; // without the image bonus; ingest adds it when an image exists
  tags?: Record<string, string>;
};

/** Score added once a Wikipedia or Wikidata image is stored. */
export const IMAGE_BONUS = 15;

const HISTORIC_VALUES = [
  "fort",
  "monument",
  "memorial",
  "ruins",
  "castle",
  "tomb",
  "city_gate",
  "archaeological_site",
];
const SHOP_VALUES = ["mall", "clothes", "sari", "textiles", "gift", "craft", "books", "market"];

/** Selectors in the Overpass query. Each one becomes `nwr[...](around:...)`. */
const SELECTORS = [
  `["historic"~"^(${HISTORIC_VALUES.join("|")})$"]`,
  `["tourism"~"^(attraction|viewpoint|museum|gallery|hotel|guest_house|hostel)$"]`,
  `["amenity"="place_of_worship"]["name"]`,
  `["amenity"~"^(restaurant|fast_food|cafe|marketplace|hospital|clinic|pharmacy|atm|bank|bus_station|taxi|fuel|toilets|police)$"]`,
  `["shop"~"^(${SHOP_VALUES.join("|")})$"]`,
  `["leisure"~"^(park|garden|nature_reserve)$"]`,
  `["railway"="station"]`,
  `["aeroway"="aerodrome"]`,
];

/** Overpass QL for every mapped tag around a city centre. */
export function buildOverpassQuery(lat: number, lng: number, radiusM: number): string {
  const around = `(around:${Math.round(radiusM)},${lat},${lng})`;
  const body = SELECTORS.map((s) => `  nwr${s}${around};`).join("\n");
  return `[out:json][timeout:180];\n(\n${body}\n);\nout center tags;`;
}

/**
 * First matching category wins. Explore rules come before facility rules, and
 * the specific explore rules (heritage, museum) before the broad ones.
 */
function categorize(t: Record<string, string>): Category | null {
  const amenity = t.amenity;
  const tourism = t.tourism;
  if (t.historic && HISTORIC_VALUES.includes(t.historic)) return "heritage";
  if (tourism === "museum" || tourism === "gallery") return "museum";
  if (tourism === "attraction" || tourism === "viewpoint") return "attraction";
  if (amenity === "place_of_worship") return "religious";
  if (t.leisure === "park" || t.leisure === "garden" || t.leisure === "nature_reserve")
    return "park";
  if (amenity === "restaurant" || amenity === "fast_food") return "food";
  if (amenity === "cafe") return "cafe";
  if ((t.shop && SHOP_VALUES.includes(t.shop)) || amenity === "marketplace") return "shopping";
  if (tourism === "hotel" || tourism === "guest_house" || tourism === "hostel") return "stay";
  if (amenity === "hospital" || amenity === "clinic") return "hospital";
  if (amenity === "pharmacy") return "pharmacy";
  if (amenity === "atm" || amenity === "bank") return "atm";
  if (
    t.railway === "station" ||
    amenity === "bus_station" ||
    t.aeroway === "aerodrome" ||
    amenity === "taxi"
  )
    return "transport";
  if (amenity === "fuel") return "fuel";
  if (amenity === "toilets") return "toilets";
  if (amenity === "police") return "police";
  return null;
}

/** A name for an unnamed facility: "SBI ATM", "Public toilet", "Railway station". */
function facilityName(category: Category, t: Record<string, string>): string {
  const brand = t["brand:en"] ?? t.brand ?? t["operator:en"] ?? t.operator;
  const withBrand = (base: string) => (brand ? `${brand} ${base}` : base);
  switch (category) {
    case "hospital":
      return t.amenity === "clinic" ? "Clinic" : "Hospital";
    case "pharmacy":
      return withBrand("Pharmacy");
    case "atm":
      return withBrand(t.amenity === "bank" ? "Bank" : "ATM");
    case "transport":
      if (t.railway === "station") return "Railway station";
      if (t.aeroway === "aerodrome") return "Airport";
      if (t.amenity === "taxi") return "Taxi stand";
      return "Bus station";
    case "fuel":
      return withBrand("Fuel station");
    case "toilets":
      return "Public toilet";
    case "police":
      return "Police station";
    default:
      return CATEGORIES[category].label;
  }
}

const CATEGORY_WEIGHT: Partial<Record<Category, number>> = {
  heritage: 30,
  attraction: 25,
  museum: 20,
  religious: 10,
  park: 10,
};

/** Tags kept on the row. Anything else in OSM is dropped. */
const TAG_WHITELIST = [
  "name:mr",
  "name:hi",
  "historic",
  "tourism",
  "amenity",
  "shop",
  "leisure",
  "religion",
  "denomination",
  "fee",
  "wheelchair",
  "operator",
  "brand",
  "start_date",
  "heritage",
];

function address(t: Record<string, string>): string | undefined {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const parts = [
    t["addr:full"] ? t["addr:full"] : street || undefined,
    t["addr:suburb"] ?? t["addr:place"],
    t["addr:city"],
    t["addr:postcode"],
  ].filter((p): p is string => !!p && p.trim().length > 0);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length > 0 ? unique.join(", ") : undefined;
}

function clean(s: string | undefined): string | undefined {
  const v = s?.trim();
  return v ? v : undefined;
}

/** Plain sum, see docs/data.md "Score". The image bonus is added by ingest. */
export function scoreOf(
  citySlug: string,
  category: Category,
  t: Record<string, string>,
  names: (string | undefined)[],
): number {
  let s = CATEGORY_WEIGHT[category] ?? 0;
  if (t.wikipedia || t.wikidata) s += 40;
  if (t.website || t["contact:website"]) s += 10;
  if (t.opening_hours) s += 10;
  if (t.phone || t["contact:phone"]) s += 10;
  if (t["name:mr"]) s += 5;
  if (CATEGORIES[category].group === "explore" && isLandmark(citySlug, names)) {
    s += LANDMARK_BONUS;
  }
  return s;
}

/** Map one Overpass element to a place row, or null if it is skipped. */
export function elementToPlace(el: OsmElement, citySlug: string): PlaceRow | null {
  return mapElement(el, citySlug)?.row ?? null;
}

function mapElement(
  el: OsmElement,
  citySlug: string,
): { row: PlaceRow; named: boolean } | null {
  const t = el.tags ?? {};
  const category = categorize(t);
  if (!category) return null;
  const group = CATEGORIES[category].group;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  const realName = clean(t["name:en"]) ?? clean(t.name) ?? clean(t["name:mr"]);
  if (!realName && group === "explore") return null;
  const name = realName ?? facilityName(category, t);

  const tags: Record<string, string> = {};
  for (const k of TAG_WHITELIST) if (t[k]) tags[k] = t[k];

  const row: PlaceRow = {
    osmId: `${el.type}/${el.id}`,
    citySlug,
    name,
    category,
    group,
    lat,
    lng,
    address: address(t),
    openingHours: clean(t.opening_hours),
    phone: clean(t.phone ?? t["contact:phone"]),
    website: clean(t.website ?? t["contact:website"] ?? t.url),
    cuisine: clean(t.cuisine),
    description: clean(t["description:en"] ?? t.description),
    wikipedia: clean(t.wikipedia),
    wikidata: clean(t.wikidata),
    score: scoreOf(citySlug, category, t, [name, t.name, t["name:en"]]),
    tags: Object.keys(tags).length > 0 ? tags : undefined,
  };
  return { row, named: realName !== undefined };
}

function distanceM(a: PlaceRow, b: PlaceRow): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Prefer the richer row; ties go to ways and relations, which carry the outline. */
function better(a: PlaceRow, b: PlaceRow): PlaceRow {
  if (a.score !== b.score) return a.score > b.score ? a : b;
  const rank = (p: PlaceRow) => (p.osmId.startsWith("node/") ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) > rank(b) ? a : b;
  return a.osmId < b.osmId ? a : b;
}

const DEDUPE_RADIUS_M = 80;
// A big site (a cave complex, a fort) is often a node at the gate and an area
// whose centre sits far inside; when either copy is wiki-tagged, look wider.
const DEDUPE_RADIUS_WIKI_M = 1000;

function sameFeature(a: PlaceRow, b: PlaceRow): boolean {
  const wiki = !!(a.wikipedia || a.wikidata || b.wikipedia || b.wikidata);
  return distanceM(a, b) <= (wiki ? DEDUPE_RADIUS_WIKI_M : DEDUPE_RADIUS_M);
}

/**
 * Map every element and drop duplicates: the same named feature mapped twice
 * (a node and a way, or two nodes) within ~80 m, or 1 km for wiki-tagged sites. Generated facility names are
 * never merged, two unnamed ATMs side by side are two ATMs.
 */
export function elementsToPlaces(elements: OsmElement[], citySlug: string): PlaceRow[] {
  const seen = new Set<string>();
  const byName = new Map<string, PlaceRow[]>();
  const out: PlaceRow[] = [];
  for (const el of elements) {
    const mapped = mapElement(el, citySlug);
    if (!mapped || seen.has(mapped.row.osmId)) continue;
    seen.add(mapped.row.osmId);
    const { row, named } = mapped;
    if (!named) {
      out.push(row);
      continue;
    }
    const key = normalizeName(row.name);
    const bucket = byName.get(key) ?? [];
    const dup = bucket.findIndex((o) => sameFeature(o, row));
    if (dup >= 0) bucket[dup] = better(bucket[dup], row);
    else bucket.push(row);
    byName.set(key, bucket);
  }
  for (const bucket of byName.values()) out.push(...bucket);
  out.sort((a, b) => b.score - a.score || (a.osmId < b.osmId ? -1 : 1));
  return out;
}
