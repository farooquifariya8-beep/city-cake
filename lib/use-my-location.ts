"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

export type MyLocation =
  | { status: "idle" | "locating" | "denied" | "unavailable" }
  | { status: "found"; lat: number; lng: number; town?: string; state?: string };

const KEY = "citycake:my-location";
const TTL = 30 * 60 * 1000;

function cached(): MyLocation | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as MyLocation & { at: number };
    return Date.now() - v.at < TTL ? v : null;
  } catch {
    return null;
  }
}

/**
 * The visitor's current town. Locates on its own when location permission is
 * already granted; otherwise waits for `locate()` from a button.
 */
export function useMyLocation() {
  const reverse = useAction(api.geo.reverse);
  const [loc, setLoc] = useState<MyLocation>({ status: "idle" });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLoc({ status: "unavailable" });
      return;
    }
    setLoc({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const base = { status: "found" as const, lat: coords.latitude, lng: coords.longitude };
        setLoc(base);
        const place = await reverse({ lat: base.lat, lng: base.lng }).catch(() => null);
        const next = { ...base, town: place?.town, state: place?.state };
        setLoc(next);
        try {
          window.sessionStorage.setItem(KEY, JSON.stringify({ ...next, at: Date.now() }));
        } catch {
          // Session storage blocked: locate again next time.
        }
      },
      (err) => setLoc({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300_000 },
    );
  }, [reverse]);

  useEffect(() => {
    const hit = cached();
    if (hit) {
      // After hydration, so the server and first client render agree.
      void Promise.resolve().then(() => setLoc(hit));
      return;
    }
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") locate();
      })
      .catch(() => {});
  }, [locate]);

  return { loc, locate };
}
