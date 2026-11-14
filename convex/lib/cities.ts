// The region the app covers. Prewarmed into Convex by `ingest.prewarmAll`.
export type CitySeed = {
  slug: string;
  name: string;
  localName: string;
  kind: "home" | "daytrip";
  lat: number;
  lng: number;
  radiusM: number;
  distanceKm: number; // approximate road distance from Chhatrapati Sambhajinagar
  blurb: string;
};

export const CITIES: CitySeed[] = [
  {
    slug: "sambhajinagar",
    name: "Chhatrapati Sambhajinagar",
    localName: "छत्रपती संभाजीनगर",
    kind: "home",
    lat: 19.8762,
    lng: 75.3433,
    radiusM: 9000,
    distanceKm: 0,
    blurb:
      "The city of 52 gates. Mughal tombs, Deccan forts and Paithani looms, and the base for Ajanta and Ellora.",
  },
  {
    slug: "ellora",
    name: "Ellora and Khuldabad",
    localName: "वेरूळ",
    kind: "daytrip",
    lat: 20.0268,
    lng: 75.1771,
    radiusM: 6000,
    distanceKm: 29,
    blurb:
      "34 rock-cut caves from the 6th to 10th century, including the Kailasa temple carved from a single cliff.",
  },
  {
    slug: "daulatabad",
    name: "Daulatabad",
    localName: "दौलताबाद",
    kind: "daytrip",
    lat: 19.9425,
    lng: 75.2135,
    radiusM: 4000,
    distanceKm: 16,
    blurb: "A hilltop fort with a moat, a dark spiral tunnel and the 30 m Chand Minar.",
  },
  {
    slug: "ajanta",
    name: "Ajanta",
    localName: "अजिंठा",
    kind: "daytrip",
    lat: 20.5519,
    lng: 75.7033,
    radiusM: 8000,
    distanceKm: 104,
    blurb:
      "Buddhist caves cut into a horseshoe gorge, with murals painted over eight centuries.",
  },
  {
    slug: "paithan",
    name: "Paithan",
    localName: "पैठण",
    kind: "daytrip",
    lat: 19.4769,
    lng: 75.3853,
    radiusM: 5000,
    distanceKm: 56,
    blurb:
      "Home of the Paithani silk sari, on the Godavari next to the Jayakwadi dam gardens.",
  },
  {
    slug: "jalna",
    name: "Jalna",
    localName: "जालना",
    kind: "daytrip",
    lat: 19.8347,
    lng: 75.8816,
    radiusM: 6000,
    distanceKm: 62,
    blurb: "A trading town east of the city, known for its seed and steel markets.",
  },
  {
    slug: "lonar",
    name: "Lonar",
    localName: "लोणार",
    kind: "daytrip",
    lat: 19.9762,
    lng: 76.5085,
    radiusM: 5000,
    distanceKm: 160,
    blurb:
      "A 1.8 km crater lake made by a meteorite about 50,000 years ago, ringed by old temples.",
  },
];
