"use client";

import { motion, useReducedMotion } from "motion/react";
import { SPEED_KMH } from "@/convex/lib/planner";
import { EASE_OUT } from "@/lib/ease";
import type { TownCard } from "./data";

// The regional palette at full strength: Ajanta ochre, malachite, Paithani peacock, lapis, magenta.
const TONES = [
  "oklch(0.68 0.13 70)",
  "oklch(0.6 0.1 160)",
  "oklch(0.6 0.09 205)",
  "oklch(0.55 0.13 262)",
  "oklch(0.6 0.15 350)",
];

/** Rough road time, at the planner's between-towns speed. */
function roadTime(km: number) {
  const min = Math.round(((km / SPEED_KMH.betweenTowns) * 60) / 5) * 5;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m}` : ""}` : `${m} min`;
}

/** How far each day trip is from the city, nearest first. */
export function DistanceChart({ trips }: { trips: TownCard[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(...trips.map((t) => t.distanceKm), 1);
  return (
    <figure>
      <figcaption className="text-[13px] font-medium text-muted-foreground">
        Road distance from the city centre
      </figcaption>
      <ul className="mt-5 space-y-3.5">
        {trips.map((t, i) => (
          <li
            key={t.slug}
            className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[110px_minmax(0,1fr)_auto]"
          >
            <span className="truncate text-[14px] font-medium">{t.name.split(" and ")[0]}</span>
            <span className="min-w-0">
              <motion.span
                className="block h-3 origin-left rounded-full"
                style={{ width: `${(t.distanceKm / max) * 100}%`, background: TONES[i % TONES.length] }}
                initial={{ scaleX: reduce ? 1 : 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.08 * i, ease: EASE_OUT }}
              />
            </span>
            <span className="w-[104px] text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">{t.distanceKm} km</span> · {roadTime(t.distanceKm)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
