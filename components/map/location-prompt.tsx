"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { LocateFixed } from "lucide-react";
import { HOME_CITY } from "@/lib/geo";
import { EASE_OUT } from "@/lib/ease";
import { useMyLocation } from "@/lib/use-my-location";

const KEY = "citycake:location-asked";

function dismissed() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Blocked storage: the card may show again next visit.
  }
}

/**
 * Asks once for location, in our words before the browser's. Until the
 * visitor answers, the map and the planner start in the home city.
 */
export function LocationPrompt() {
  const { loc, locate } = useMyLocation();
  const reduce = useReducedMotion();
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (dismissed()) return;
    let live = true;
    const show = () => live && setAsk(true);
    const t = setTimeout(() => {
      if (!navigator.geolocation) return;
      const perms = navigator.permissions?.query({ name: "geolocation" });
      if (!perms) return show();
      perms.then((p) => p.state === "prompt" && show()).catch(show);
    }, 700);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, []);

  const open = ask && loc.status === "idle";

  function close() {
    remember();
    setAsk(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-labelledby="loc-title"
          initial={{ opacity: 0, y: reduce ? 0 : -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -8 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="material absolute inset-x-3 top-[max(calc(env(safe-area-inset-top)+80px),80px)] z-40 rounded-[22px] p-4 md:top-3 md:right-[64px] md:left-auto md:w-[360px]"
        >
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--route)] text-white">
              <LocateFixed className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="loc-title" className="text-[16px] font-semibold tracking-[-0.01em]">
                Use your location
              </h2>
              <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">
                Trips start where you are, and the drive follows you on the map. Until then we start in {HOME_CITY.name}.
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={close}
              className="press h-10 flex-1 rounded-full bg-black/[0.055] text-[14px] font-medium hover:bg-black/10 dark:bg-white/10"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                locate();
              }}
              className="press h-10 flex-1 rounded-full bg-[var(--route)] text-[14px] font-medium text-white hover:brightness-110"
            >
              Allow location
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
