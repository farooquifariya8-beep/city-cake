// Run with `bun test scripts/navigation.test.ts`.
import { describe, expect, test } from "bun:test";
import { buildTrack, instruction, progressAt, snap, splitAt, type NavRoute } from "../lib/navigation";

// About 1.05 km east along a road, a left turn, then 1.1 km north to a stop,
// and a second leg 1.1 km further north.
const A: [number, number] = [75.3, 19.88];
const B: [number, number] = [75.31, 19.88];
const C: [number, number] = [75.31, 19.89];
const D: [number, number] = [75.31, 19.9];

const route: NavRoute = {
  coordinates: [A, [75.305, 19.88], B, [75.31, 19.885], C, [75.31, 19.895], D],
  distanceM: 3260,
  durationS: 300,
  legs: [
    { distanceM: 2160, durationS: 200 },
    { distanceM: 1100, durationS: 100 },
  ],
  steps: [
    { leg: 0, type: "depart", name: "Jalna Road", distanceM: 1050, durationS: 100, lng: A[0], lat: A[1] },
    { leg: 0, type: "turn", modifier: "left", name: "Station Road", distanceM: 1110, durationS: 100, lng: B[0], lat: B[1] },
    { leg: 0, type: "arrive", name: "", distanceM: 0, durationS: 0, lng: C[0], lat: C[1] },
    { leg: 1, type: "depart", name: "Station Road", distanceM: 1100, durationS: 100, lng: C[0], lat: C[1] },
    { leg: 1, type: "arrive", name: "", distanceM: 0, durationS: 0, lng: D[0], lat: D[1] },
  ],
};

describe("navigation", () => {
  const track = buildTrack(route);

  test("measures the line and places each maneuver along it", () => {
    expect(track.total).toBeGreaterThan(3100);
    expect(track.total).toBeLessThan(3300);
    const at = track.steps.map((s) => s.at);
    [0, 1050, 2160, 2160, track.total].forEach((m, i) => expect(Math.abs(at[i] - m)).toBeLessThan(60));
    expect(track.legEnds).toHaveLength(2);
    expect(track.legEnds[1]).toBe(track.total);
  });

  test("snaps a fix a little off the road and reads the next turn", () => {
    const s = snap(track, [75.303, 19.8802]);
    expect(s.index).toBe(0);
    expect(s.offM).toBeLessThan(30);
    expect(Math.round(s.bearing)).toBe(90);
    const p = progressAt(track, s.along);
    expect(p.next?.type).toBe("turn");
    expect(p.toNextM).toBeGreaterThan(700);
    expect(p.toNextM).toBeLessThan(800);
    expect(p.leg).toBe(0);
    expect(p.remainingS).toBeGreaterThan(260);
    expect(p.remainingS).toBeLessThan(300);
    expect(instruction(p.next!)).toBe("Turn left onto Station Road");
  });

  test("after the turn, heads for the first stop, then the second leg", () => {
    const s = snap(track, [75.3101, 19.887], 2);
    expect(s.index).toBe(3);
    const p = progressAt(track, s.along);
    expect(p.next?.type).toBe("arrive");
    expect(instruction(p.next!, "Bibi Ka Maqbara")).toBe("Arrive at Bibi Ka Maqbara");
    expect(p.leg).toBe(0);
    const later = progressAt(track, snap(track, [75.31, 19.893]).along);
    expect(later.leg).toBe(1);
    expect(later.toLegEndM).toBeGreaterThan(700);
  });

  test("on a road driven out and back, the snap keeps moving forward", () => {
    const back = buildTrack({
      coordinates: [A, [75.305, 19.88], B, [75.305, 19.88], A],
      distanceM: 2100,
      durationS: 200,
      legs: [{ distanceM: 2100, durationS: 200 }],
      steps: [],
    });
    const out = snap(back, [75.304, 19.88]);
    expect(out.index).toBe(0);
    // Driving out with the hint behind: the return lane, later in the line, must not win.
    const goingOut = snap(back, [75.307, 19.88], 1);
    expect(goingOut.index).toBe(1);
    expect(goingOut.along).toBeLessThan(back.total / 2);
    // Same spot after the U-turn, heading west: the heading picks the return lane.
    const turned = snap(back, [75.307, 19.88], 1, 270);
    expect(turned.index).toBe(2);
    expect(turned.along).toBeGreaterThan(back.total / 2);
    // Same spot on the way back: with the hint past the turn it stays on the way back.
    const home = snap(back, [75.304, 19.88], 2);
    expect(home.index).toBe(3);
    expect(home.along).toBeGreaterThan(back.total / 2);
  });

  test("flags a fix far from the road", () => {
    expect(snap(track, [75.32, 19.87]).offM).toBeGreaterThan(500);
  });

  test("splits the line at the snap", () => {
    const s = snap(track, [75.307, 19.88]);
    const { done, ahead } = splitAt(track, s);
    expect(done[done.length - 1]).toEqual(s.point);
    expect(ahead[0]).toEqual(s.point);
    expect(done.length + ahead.length).toBe(route.coordinates.length + 2);
  });

  test("words the common maneuvers", () => {
    const base = { leg: 0, distanceM: 0, durationS: 0, lng: 0, lat: 0 };
    expect(instruction({ ...base, type: "roundabout", exit: 2, name: "Beed Bypass" })).toBe(
      "At the roundabout, take the second exit onto Beed Bypass",
    );
    expect(instruction({ ...base, type: "fork", modifier: "slight right", name: "", ref: "NH52" })).toBe(
      "At the fork, keep slightly right onto NH52",
    );
    expect(instruction({ ...base, type: "continue", modifier: "uturn", name: "" })).toBe("Make a U-turn");
    expect(instruction({ ...base, type: "new name", modifier: "straight", name: "Ellora Road" })).toBe("Continue on Ellora Road");
  });
});
