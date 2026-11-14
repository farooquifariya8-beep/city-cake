// Shared between Convex functions and the Next.js app.
// `hue` is an oklch hue angle; the UI derives fills and strokes from it.

export type CategoryGroup = "explore" | "facility";

export const CATEGORIES = {
  // Explore
  heritage: { label: "Heritage", group: "explore", hue: 70, icon: "Landmark" },
  attraction: { label: "Sights", group: "explore", hue: 38, icon: "Camera" },
  museum: { label: "Museums", group: "explore", hue: 262, icon: "Building2" },
  religious: { label: "Temples and shrines", group: "explore", hue: 55, icon: "Flower2" },
  food: { label: "Food", group: "explore", hue: 350, icon: "UtensilsCrossed" },
  cafe: { label: "Cafes", group: "explore", hue: 25, icon: "Coffee" },
  shopping: { label: "Shopping", group: "explore", hue: 200, icon: "ShoppingBag" },
  park: { label: "Parks", group: "explore", hue: 150, icon: "Trees" },
  stay: { label: "Stays", group: "explore", hue: 300, icon: "BedDouble" },
  // Facilities
  hospital: { label: "Hospitals", group: "facility", hue: 25, icon: "Hospital" },
  pharmacy: { label: "Pharmacies", group: "facility", hue: 160, icon: "Pill" },
  atm: { label: "ATMs and banks", group: "facility", hue: 250, icon: "Banknote" },
  transport: { label: "Transport", group: "facility", hue: 280, icon: "TrainFront" },
  fuel: { label: "Fuel", group: "facility", hue: 60, icon: "Fuel" },
  toilets: { label: "Public toilets", group: "facility", hue: 210, icon: "Bath" },
  police: { label: "Police", group: "facility", hue: 240, icon: "Shield" },
} as const satisfies Record<
  string,
  { label: string; group: CategoryGroup; hue: number; icon: string }
>;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];
export const EXPLORE_CATEGORIES = CATEGORY_KEYS.filter(
  (c) => CATEGORIES[c].group === "explore",
);
export const FACILITY_CATEGORIES = CATEGORY_KEYS.filter(
  (c) => CATEGORIES[c].group === "facility",
);
