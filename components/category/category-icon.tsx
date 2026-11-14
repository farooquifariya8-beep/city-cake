import {
  Banknote,
  Bath,
  BedDouble,
  Building2,
  Camera,
  Coffee,
  Flower2,
  Fuel,
  Hospital,
  Landmark,
  MapPin,
  Pill,
  Shield,
  ShoppingBag,
  TrainFront,
  Trees,
  UtensilsCrossed,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { CATEGORIES, type Category } from "@/convex/lib/categories";

// Keyed by the icon name stored in categories.ts, not by category.
const ICONS: Record<string, LucideIcon> = {
  Banknote,
  Bath,
  BedDouble,
  Building2,
  Camera,
  Coffee,
  Flower2,
  Fuel,
  Hospital,
  Landmark,
  Pill,
  Shield,
  ShoppingBag,
  TrainFront,
  Trees,
  UtensilsCrossed,
};

export function categoryLabel(category: string): string {
  return category in CATEGORIES ? CATEGORIES[category as Category].label : "Place";
}

export function CategoryIcon({ category, ...props }: { category: string } & LucideProps) {
  const name = category in CATEGORIES ? CATEGORIES[category as Category].icon : "";
  const Icon = ICONS[name] ?? MapPin;
  return <Icon strokeWidth={1.75} aria-hidden {...props} />;
}
