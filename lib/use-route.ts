"use client";

import { useAction } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { LngLat } from "./geo";

export type Profile = "driving" | "foot";
export type RouteResult = { coordinates: LngLat[]; distanceM: number; durationS: number };

export type RouteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; route: RouteResult }
  | { status: "error"; message: string };

/** Ask Convex for a road route. Late answers to older requests are dropped. */
export function useRoute() {
  const getRoute = useAction(api.routes.get);
  const [state, setState] = useState<RouteState>({ status: "idle" });
  const seq = useRef(0);

  const run = useCallback(
    async (points: { lat: number; lng: number }[], profile: Profile) => {
      const id = ++seq.current;
      if (points.length < 2) {
        setState({ status: "idle" });
        return;
      }
      setState({ status: "loading" });
      try {
        const route = await getRoute({ points, profile });
        if (id !== seq.current) return;
        setState(
          route
            ? { status: "ready", route: route as RouteResult }
            : {
                status: "error",
                message:
                  profile === "foot"
                    ? "No walking route was found. Try driving."
                    : "No road route was found between these points.",
              },
        );
      } catch {
        if (id !== seq.current) return;
        setState({ status: "error", message: "The routing service didn't answer. Try again." });
      }
    },
    [getRoute],
  );

  const clear = useCallback(() => {
    seq.current++;
    setState({ status: "idle" });
  }, []);

  return { state, run, clear };
}
