"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { categoryTone } from "@/lib/category-style";

// An isometric, exploded view of how the planner builds a day: three plates,
// from all the places in town, to the few picked and chained nearest-next, to
// a timed day. Drawn by hand in a 2:1 projection: (x, y, z) -> (x - y, (x + y) / 2 - z).

const S = 150; // plate side, in plan units
const T = 9; // plate thickness
const OX = 170; // screen x of the plate's back corner
const GAP = 150; // vertical distance between plates once exploded
const OY = 22 + 2 * GAP; // room above for the top plate

const iso = (x: number, y: number, z = 0) => [OX + x - y, OY + (x + y) / 2 - z] as const;
const pts = (list: (readonly [number, number])[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const PLANE = `matrix(1 0.5 -1 0.5 ${OX} ${OY})`;

const fill = (cat: string) => categoryTone(cat, "light").fill;

// All places in town, scattered across the top plate.
const SCATTER = ([
  [26, 30, "heritage"], [64, 18, "food"], [110, 34, "museum"], [128, 76, "park"], [92, 64, "heritage"],
  [40, 82, "religious"], [22, 122, "cafe"], [70, 112, "heritage"], [114, 124, "shopping"], [52, 52, "attraction"],
  [134, 22, "religious"], [86, 136, "food"],
] as [number, number, string][]).sort((a, b) => a[0] + a[1] - (b[0] + b[1])); // back to front, so nearer pins overlap farther ones
// The four picked for a balanced day, nearest next.
const PICKED: [number, number, string][] = [
  [30, 34, "heritage"], [74, 48, "heritage"], [106, 92, "food"], [72, 126, "museum"],
];
// The day as blocks of time along one edge: sights, travel gaps and lunch.
const DAY: [number, number, string][] = [
  [14, 36, "heritage"], [56, 30, "heritage"], [92, 20, "food"], [118, 22, "museum"],
];

function Plate({ z }: { z: number }) {
  const a = iso(0, S, z), b = iso(S, S, z), c = iso(S, 0, z);
  const down = (p: readonly [number, number]) => [p[0], p[1] + T] as const;
  return (
    <>
      <polygon points={pts([a, b, down(b), down(a)])} fill="oklch(0.9 0.025 78)" />
      <polygon points={pts([b, c, down(c), down(b)])} fill="oklch(0.85 0.03 72)" />
      <polygon
        points={pts([iso(0, 0, z), c, b, a])}
        fill="oklch(0.995 0.006 85)"
        stroke="rgb(60 40 10 / 0.08)"
        strokeWidth="1"
      />
    </>
  );
}

function Pin({ x, y, z, color, label }: { x: number; y: number; z: number; color: string; label?: string }) {
  const [sx, sy] = iso(x, y, z);
  const h = label ? 22 : 14;
  return (
    <g>
      <ellipse cx={sx} cy={sy} rx="5" ry="2.5" fill="rgb(60 40 10 / 0.16)" />
      <line x1={sx} y1={sy} x2={sx} y2={sy - h} stroke="rgb(60 40 10 / 0.45)" strokeWidth="1.25" />
      <circle cx={sx} cy={sy - h} r={label ? 7.5 : 4.5} fill={color} stroke="white" strokeWidth="1.5" />
      {label && (
        <text x={sx} y={sy - h + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="white">
          {label}
        </text>
      )}
    </g>
  );
}

export function PlanFigure() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  // Plates start stacked tight and open up as the figure reaches the middle of the screen.
  const top = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 70, 0]);
  const bottom = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : -70, 0]);

  const zTop = GAP * 2, zMid = GAP, zLow = 0;
  const route = PICKED.map(([x, y]) => `${x},${y}`).join(" L");

  return (
    <div ref={ref} className="mx-auto w-full max-w-[460px]">
      <svg
        viewBox="0 0 340 492"
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Three stacked plates: all places in town, four picked and joined nearest first, and the same four as a timed day."
      >
        {/* Guides between plates. */}
        {[iso(0, 0), iso(S, 0), iso(0, S), iso(S, S)].map(([x, y], i) => (
          <line key={i} x1={x} y1={y - zTop} x2={x} y2={y} stroke="rgb(60 40 10 / 0.12)" strokeDasharray="2 4" />
        ))}

        {/* 3: the timed day. */}
        <motion.g style={{ y: bottom }}>
          <Plate z={zLow} />
          <g transform={`translate(0 ${-zLow}) ${PLANE}`}>
            <line x1="10" y1="132" x2="142" y2="132" stroke="rgb(60 40 10 / 0.2)" strokeWidth="1.5" />
            {DAY.map(([x, w, cat], i) => (
              <rect key={i} x={x} y="112" width={w} height="14" rx="4" fill={fill(cat)} />
            ))}
            {[14, 56, 92, 118].map((x) => (
              <line key={x} x1={x} y1="132" x2={x} y2="137" stroke="rgb(60 40 10 / 0.35)" strokeWidth="1.5" />
            ))}
            <rect x="14" y="40" width="70" height="40" rx="8" fill="oklch(0.96 0.02 85)" />
            <rect x="22" y="50" width="36" height="5" rx="2.5" fill="rgb(60 40 10 / 0.35)" />
            <rect x="22" y="62" width="52" height="5" rx="2.5" fill="rgb(60 40 10 / 0.18)" />
          </g>
        </motion.g>

        {/* 2: four picks, chained nearest next. */}
        <g>
          <Plate z={zMid} />
          <g transform={`translate(0 ${-zMid}) ${PLANE}`}>
            <motion.path
              d={`M${route}`}
              fill="none"
              stroke="var(--route)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduce ? 1 : 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: reduce ? 0 : 1.2, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
            />
          </g>
          {PICKED.map(([x, y, cat], i) => (
            <Pin key={i} x={x} y={y} z={zMid} color={fill(cat)} label={String(i + 1)} />
          ))}
        </g>

        {/* 1: every place in town. */}
        <motion.g style={{ y: top }}>
          <Plate z={zTop} />
          {SCATTER.map(([x, y, cat], i) => (
            <Pin key={i} x={x} y={y} z={zTop} color={fill(cat)} />
          ))}
        </motion.g>
      </svg>
    </div>
  );
}
