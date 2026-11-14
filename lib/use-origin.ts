"use client";

import { useCallback, useState } from "react";
import type { CitySeed } from "@/convex/lib/cities";
import { nearestCity } from "./geo";

export type OriginState = {
  status: "idle" | "locating" | "user" | "fallback";
  lat: number;
  lng: number;
  /** Why the city centre is in use, in words for the UI. */
  reason?: string;
};

// Remember a fix for the session, so moving between pages doesn't re-prompt.
let lastFix: { lat: number; lng: number; at: number } | null = null;
const FIX_TTL = 5 * 60 * 1000;
const REGION_LIMIT_M = 60_000;

/**
 * The visitor's location, or the city centre when location is off, denied,
 * slow, or outside the region. Call `locate()` to ask.
 */
export function useOrigin(fallback: CitySeed) {
  const [state, setState] = useState<OriginState>(() =>
    lastFix && Date.now() - lastFix.at < FIX_TTL
      ? { status: "user", lat: lastFix.lat, lng: lastFix.lng }
      : { status: "idle", lat: fallback.lat, lng: fallback.lng },
  );

  const locate = useCallback((): Promise<OriginState> => {
    const toFallback = (reason: string): OriginState => {
      const next: OriginState = { status: "fallback", lat: fallback.lat, lng: fallback.lng, reason };
      setState(next);
      return next;
    };
    if (lastFix && Date.now() - lastFix.at < FIX_TTL) {
      const next: OriginState = { status: "user", lat: lastFix.lat, lng: lastFix.lng };
      setState(next);
      return Promise.resolve(next);
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return Promise.resolve(toFallback("This browser can't share location."));
    }
    setState((s) => ({ ...s, status: "locating" }));
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          if (nearestCity(lat, lng).distanceM > REGION_LIMIT_M) {
            resolve(toFallback("You're outside the region."));
            return;
          }
          lastFix = { lat, lng, at: Date.now() };
          const next: OriginState = { status: "user", lat, lng };
          setState(next);
          resolve(next);
        },
        (err) =>
          resolve(
            toFallback(
              err.code === err.PERMISSION_DENIED
                ? "Location permission is off."
                : "Your location isn't available right now.",
            ),
          ),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }, [fallback.lat, fallback.lng]);

  return { origin: state, locate };
}
