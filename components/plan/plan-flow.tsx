"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { planRouteTrip, type RouteStop } from "@/convex/lib/routeTrip";
import { useMapScene, type Scene } from "@/components/map/map-store";
import { EASE_OUT } from "@/lib/ease";
import { boundsOf } from "@/lib/geo";
import { draftFromPlan, setDraft } from "@/lib/plan-draft";
import { endsKey, setRoadTrip, useRoadTrip, type End } from "@/lib/road-trip";
import { useMyLocation } from "@/lib/use-my-location";
import { PickStep, type Along } from "./pick-step";
import { PlanBuilder } from "./plan-builder";
import { WhereStep } from "./where-step";

/**
 * /plan: three steps. Where to, pick stops on the road, then the days in the
 * builder. The builder on its own stays reachable for planning by hand.
 */
export function PlanFlow() {
  const trip = useRoadTrip();
  const { loc, locate } = useMyLocation();
  const reduce = useReducedMotion();

  const onFind = useCallback((from: End) => {
    setRoadTrip((t) => ({
      ranFrom: from,
      step: "pick",
      picked: t.to && t.ranFrom && endsKey(t.ranFrom, t.to) === endsKey(from, t.to) ? t.picked : [],
    }));
  }, []);

  const onMake = useCallback(
    (data: Along, picked: RouteStop[]) => {
      if (!trip.ranFrom || !trip.to) return;
      const plan = planRouteTrip({ from: trip.ranFrom, to: trip.to, days: trip.days, route: data.route, stops: picked });
      setDraft(draftFromPlan(plan));
      setRoadTrip({ step: "trip" });
      toast(`Planned ${plan.days.length} ${plan.days.length === 1 ? "day" : "days"}. Change anything you like.`);
    },
    [trip.ranFrom, trip.to, trip.days],
  );

  const step = trip.step;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        initial={{ opacity: 0, x: reduce ? 0 : 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: reduce ? 0 : -24 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
      >
        {step === "where" && (
          <>
            <WhereScene from={trip.from ?? (loc.status === "found" ? { name: "My location", lat: loc.lat, lng: loc.lng } : null)} to={trip.to} />
            <WhereStep loc={loc} locate={locate} onFind={onFind} />
            <p className="px-4 pb-6 text-center text-[13px] text-muted-foreground">
              Planning inside the city?{" "}
              <button type="button" onClick={() => setRoadTrip({ step: "build" })} className="font-medium text-link hover:underline">
                Build it yourself
              </button>
            </p>
          </>
        )}
        {step === "pick" && trip.ranFrom && trip.to && (
          <PickStep from={trip.ranFrom} to={trip.to} onBack={() => setRoadTrip({ step: "where" })} onMake={onMake} />
        )}
        {step === "trip" && <PlanBuilder back={{ label: "Back to stops", onClick: () => setRoadTrip({ step: "pick" }) }} />}
        {step === "build" && <PlanBuilder back={{ label: "Plan a road trip", onClick: () => setRoadTrip({ step: "where" }) }} />}
      </motion.div>
    </AnimatePresence>
  );
}

/** Step 1's map: the chosen ends, framed. */
function WhereScene({ from, to }: { from: End | null; to: End | null }) {
  const scene = useMemo<Scene>(() => {
    const ends = [from, to].filter((e): e is End => !!e).map((e, i) => ({ id: `end-${i}`, name: e.name, category: "attraction", lat: e.lat, lng: e.lng }));
    return {
      points: [],
      stops: ends,
      camera: ends.length ? { key: `ends:${ends.map((e) => `${e.lat},${e.lng}`).join(";")}`, bounds: boundsOf(ends), maxZoom: 11 } : null,
    };
  }, [from, to]);
  useMapScene(scene);
  return null;
}
