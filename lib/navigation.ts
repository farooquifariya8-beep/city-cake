/**
 * Turn-by-turn maths for /journey, pure and testable. A route from
 * routes.navigate becomes a Track: the line with cumulative metres, and each
 * maneuver placed at its distance along the line. A GPS fix is snapped onto
 * the line, and everything else (next turn, time left, the leg we're on)
 * reads off the distance along.
 */
import type { NavLeg, NavRoute, NavStep } from "@/convex/routes";
import type { LngLat } from "./geo";

export type { NavRoute, NavStep };

export type TrackStep = NavStep & { at: number };

export type Track = {
  coords: LngLat[];
  /** Metres from the start to each vertex. */
  cum: number[];
  total: number;
  durationS: number;
  legs: NavLeg[];
  steps: TrackStep[];
  /** Metres along the line where each leg ends. */
  legEnds: number[];
};

export type Snap = {
  /** Segment index: the snapped point lies between coords[index] and coords[index + 1]. */
  index: number;
  along: number;
  /** How far the fix is from the line. */
  offM: number;
  point: LngLat;
  /** Direction of travel along the line here, degrees from north. */
  bearing: number;
};

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG = 111_320;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Planar metres from `o`, accurate to well under a metre over a few kilometres. */
function local(o: LngLat, p: LngLat): [number, number] {
  return [(p[0] - o[0]) * M_PER_DEG_LNG * Math.cos(toRad(o[1])), (p[1] - o[1]) * M_PER_DEG_LAT];
}

function dist(a: LngLat, b: LngLat): number {
  const [x, y] = local(a, b);
  return Math.hypot(x, y);
}

export function bearingDeg(a: LngLat, b: LngLat): number {
  const [x, y] = local(a, b);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

/** Closest point to `p` on segment a-b: the fraction along it and the distance off it. */
function onSegment(p: LngLat, a: LngLat, b: LngLat): { t: number; off: number } {
  const [bx, by] = local(a, b);
  const [px, py] = local(a, p);
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / len2));
  return { t, off: Math.hypot(px - t * bx, py - t * by) };
}

function snapIn(track: Track, p: LngLat, from: number, to: number): Snap {
  const { coords, cum } = track;
  let best = { i: from, t: 0, off: Infinity };
  for (let i = from; i < to; i++) {
    const s = onSegment(p, coords[i], coords[i + 1]);
    if (s.off < best.off) best = { i, t: s.t, off: s.off };
  }
  const a = coords[best.i];
  const b = coords[best.i + 1];
  return {
    index: best.i,
    along: cum[best.i] + (cum[best.i + 1] - cum[best.i]) * best.t,
    offM: best.off,
    point: [a[0] + (b[0] - a[0]) * best.t, a[1] + (b[1] - a[1]) * best.t],
    bearing: bearingDeg(a, b),
  };
}

/** Smallest angle between two bearings, 0 to 180. */
export function turnBetween(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Snap a fix onto the route. With `hint` (the last segment) it takes the
 * earliest close segment from there that runs the way we're heading. On a
 * road driven out and back, both lanes are close: order keeps us off the
 * return lane on the way in, and `heading` moves us onto it after the U-turn.
 * Falls back to the nearest segment around the hint, then the whole line.
 */
export function snap(track: Track, p: LngLat, hint?: number, heading?: number | null): Snap {
  const last = track.coords.length - 1;
  if (hint !== undefined) {
    let first = -1;
    for (let i = Math.max(0, hint - 1); i < Math.min(last, hint + 400); i++) {
      const a = track.coords[i];
      const b = track.coords[i + 1];
      if (onSegment(p, a, b).off >= 20) continue;
      if (first < 0) first = i;
      if (heading == null || turnBetween(bearingDeg(a, b), heading) < 90) return snapIn(track, p, i, i + 1);
    }
    if (first >= 0) return snapIn(track, p, first, first + 1);
    const near = snapIn(track, p, Math.max(0, hint - 10), Math.min(last, hint + 400));
    if (near.offM < 60) return near;
  }
  return snapIn(track, p, 0, last);
}

export function buildTrack(route: NavRoute): Track {
  const coords = route.coordinates;
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]));
  const total = cum[cum.length - 1];
  const track: Track = { coords, cum, total, durationS: route.durationS, legs: route.legs, steps: [], legEnds: [] };

  // Place each maneuver at the first point of the line that passes it, moving
  // forward only, so a road travelled twice keeps its order.
  let from = 0;
  const steps: TrackStep[] = [];
  for (const st of route.steps) {
    const p: LngLat = [st.lng, st.lat];
    let found: Snap | null = null;
    for (let i = from; i < coords.length - 1; i++) {
      const s = onSegment(p, coords[i], coords[i + 1]);
      if (s.off < 15) {
        found = snapIn(track, p, i, Math.min(coords.length - 1, i + 3));
        break;
      }
    }
    found ??= snapIn(track, p, from, coords.length - 1);
    from = found.index;
    steps.push({ ...st, at: found.along });
  }
  track.steps = steps;

  const arrives = steps.filter((s) => s.type === "arrive").map((s) => s.at);
  if (arrives.length === route.legs.length) {
    track.legEnds = arrives;
  } else {
    // No arrive steps: split the line by the legs' own lengths.
    const sum = route.legs.reduce((n, l) => n + l.distanceM, 0) || 1;
    let run = 0;
    track.legEnds = route.legs.map((l) => (run += (l.distanceM / sum) * total));
  }
  track.legEnds[track.legEnds.length - 1] = total;
  return track;
}

/** Seconds of driving from `along` to `until` metres, from the steps' own timings. */
export function secondsBetween(track: Track, along: number, until: number): number {
  const { steps } = track;
  if (steps.length < 2) return track.total ? track.durationS * Math.max(0, until - along) / track.total : 0;
  let s = 0;
  for (let k = 0; k < steps.length; k++) {
    const start = steps[k].at;
    const end = k + 1 < steps.length ? steps[k + 1].at : track.total;
    if (end <= start) continue;
    const lo = Math.max(start, along);
    const hi = Math.min(end, until);
    if (hi > lo) s += steps[k].durationS * ((hi - lo) / (end - start));
  }
  return s;
}

export type Progress = {
  remainingM: number;
  remainingS: number;
  /** The maneuver ahead, or null past the last one. */
  next: TrackStep | null;
  toNextM: number;
  /** The maneuver after it, when it comes soon after. */
  then: TrackStep | null;
  /** The leg being driven, counted from this route's start. */
  leg: number;
  toLegEndM: number;
  legRemainingS: number;
};

const THEN_WITHIN_M = 400;

export function progressAt(track: Track, along: number): Progress {
  const a = Math.min(Math.max(0, along), track.total);
  const ahead = track.steps.findIndex((s) => s.at > a + 3 && s.type !== "depart");
  const next = ahead >= 0 ? track.steps[ahead] : null;
  const after = ahead >= 0 ? track.steps[ahead + 1] : undefined;
  const then = next && after && after.at - next.at < THEN_WITHIN_M ? after : null;
  let leg = track.legEnds.findIndex((end) => end >= a - 1);
  if (leg < 0) leg = track.legEnds.length - 1;
  const legEnd = track.legEnds[leg] ?? track.total;
  return {
    remainingM: track.total - a,
    remainingS: secondsBetween(track, a, track.total),
    next,
    toNextM: next ? next.at - a : 0,
    then,
    leg,
    toLegEndM: Math.max(0, legEnd - a),
    legRemainingS: secondsBetween(track, a, legEnd),
  };
}

/** Coordinates split at a snap: the part driven and the part ahead. */
export function splitAt(track: Track, s: Snap): { done: LngLat[]; ahead: LngLat[] } {
  return {
    done: [...track.coords.slice(0, s.index + 1), s.point],
    ahead: [s.point, ...track.coords.slice(s.index + 1)],
  };
}

export type ManeuverIcon =
  | "straight"
  | "left"
  | "right"
  | "slight-left"
  | "slight-right"
  | "sharp-left"
  | "sharp-right"
  | "uturn"
  | "roundabout"
  | "merge"
  | "arrive"
  | "depart";

export function maneuverIcon(step: NavStep): ManeuverIcon {
  if (step.type === "arrive") return "arrive";
  if (step.type === "depart") return "depart";
  if (step.type.includes("roundabout") || step.type.includes("rotary")) return "roundabout";
  if (step.type === "merge") return "merge";
  switch (step.modifier) {
    case "left":
      return "left";
    case "right":
      return "right";
    case "slight left":
      return "slight-left";
    case "slight right":
      return "slight-right";
    case "sharp left":
      return "sharp-left";
    case "sharp right":
      return "sharp-right";
    case "uturn":
      return "uturn";
    default:
      return "straight";
  }
}

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const SIDE: Record<string, string> = {
  left: "left",
  right: "right",
  "slight left": "slightly left",
  "slight right": "slightly right",
  "sharp left": "sharp left",
  "sharp right": "sharp right",
  straight: "straight",
};

/** The road a step leads onto, by name or number. */
export function roadOf(step: NavStep): string | null {
  return step.name || step.ref || null;
}

/** What to do at a maneuver, in plain words: "Turn left onto Jalna Road". */
export function instruction(step: NavStep, stopName?: string): string {
  const mod = step.modifier ?? "";
  const side = SIDE[mod] ?? mod;
  const road = roadOf(step);
  const onto = road ? ` onto ${road}` : "";
  if (mod === "uturn" && step.type !== "arrive") return `Make a U-turn${road ? ` on ${road}` : ""}`;
  switch (step.type) {
    case "arrive":
      return stopName ? `Arrive at ${stopName}` : "Arrive at your stop";
    case "depart":
      return road ? `Head out on ${road}` : "Head out";
    case "turn":
      return mod === "straight" ? `Go straight${road ? ` on ${road}` : ""}` : `Turn ${side}${onto}`;
    case "end of road":
      return `At the end of the road, turn ${side}${onto}`;
    case "fork":
      return `At the fork, keep ${side}${onto}`;
    case "merge":
      return `Merge${side && mod !== "straight" ? ` ${side}` : ""}${onto}`;
    case "on ramp":
      return `Take the ramp${side && mod !== "straight" ? ` on the ${mod.replace("slight ", "")}` : ""}${onto}`;
    case "off ramp":
      return `Take the exit${side && mod !== "straight" ? ` on the ${mod.replace("slight ", "")}` : ""}${onto}`;
    case "roundabout":
    case "rotary":
    case "roundabout turn":
      return step.exit && ORDINAL[step.exit - 1]
        ? `At the roundabout, take the ${ORDINAL[step.exit - 1]} exit${onto}`
        : `Go through the roundabout${onto}`;
    case "exit roundabout":
    case "exit rotary":
      return `Leave the roundabout${onto}`;
    case "continue":
    case "new name":
      if (!mod || mod === "straight") return road ? `Continue on ${road}` : "Continue straight";
      return `Keep ${side}${onto}`;
    default:
      return mod && mod !== "straight" ? `Keep ${side}${onto}` : road ? `Continue on ${road}` : "Continue";
  }
}

/** How far to the next turn, rounded the way a driver reads it. */
export function formatToTurn(m: number): string {
  if (m < 50) return "Now";
  if (m < 1000) return `${m < 300 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Off the route by more than this, a few fixes in a row, means reroute. */
export const OFF_ROUTE_M = 50;
/** Within this of a stop counts as being there. */
export const ARRIVE_M = 60;
