// Hand-picked landmarks per city. A place in the explore group whose name
// contains one of these patterns (case-insensitive, punctuation ignored)
// gets LANDMARK_BONUS added to its score, so the sights a local would name
// first lead their city. See docs/data.md, "Score".

export const LANDMARK_BONUS = 100;

export const LANDMARKS: Record<string, string[]> = {
  sambhajinagar: [
    "bibi ka maqbara",
    "aurangabad caves",
    "panchakki",
    "pan chakki",
    "siddharth garden",
    "himroo",
    "soneri mahal",
  ],
  ellora: [
    "kailasa",
    "kailash temple",
    "ellora caves",
    "grishneshwar",
    "ghrishneshwar",
  ],
  daulatabad: ["daulatabad fort", "devagiri", "chand minar"],
  ajanta: ["ajanta caves", "ajanta cave"],
  paithan: ["jayakwadi", "dnyaneshwar udyan", "dnyaneshwar garden"],
  jalna: [],
  lonar: ["lonar crater", "lonar lake", "daitya sudan", "daityasudan"],
};

/** Names that mention a landmark without being it: "Hilltop (good view of Bibi Ka Maqbara)". */
const NOT_LANDMARK = ["view of", "near", "opposite", "parking"];

/** Lowercase, punctuation to spaces, single spaces. "Bibi-ka-Maqbara" -> "bibi ka maqbara". */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True if any of the names matches a landmark pattern for the city. */
export function isLandmark(citySlug: string, names: (string | undefined)[]): boolean {
  const patterns = LANDMARKS[citySlug];
  if (!patterns || patterns.length === 0) return false;
  return names.some((n) => {
    if (!n) return false;
    const norm = normalizeName(n);
    const padded = ` ${norm} `;
    if (NOT_LANDMARK.some((x) => padded.includes(` ${x} `))) return false;
    return patterns.some((p) => norm.includes(p));
  });
}
