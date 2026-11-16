"use client";

import { useConvex } from "convex/react";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";

export type MyLocation =
  | { status: "idle" | "locating" | "denied" | "unavailable" }
  | { status: "found"; lat: number; lng: number; town?: string; state?: string };

const KEY = "citycake:my-location";
const TTL = 30 * 60 * 1000;
const IDLE: MyLocation = { status: "idle" };

// One location for the whole app, so a prompt on one screen updates them all.
let current: MyLocation = IDLE;
let checked = false;
const listeners = new Set<() => void>();

function set(next: MyLocation) {
  current = next;
  listeners.forEach((l) => l());
}

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

type Reverse = (p: { lat: number; lng: number }) => Promise<{ town?: string; state?: string } | null>;

function locateWith(reverse: Reverse) {
  if (!navigator.geolocation) {
    set({ status: "unavailable" });
    return;
  }
  if (current.status === "locating") return;
  set({ status: "locating" });
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const base = { status: "found" as const, lat: coords.latitude, lng: coords.longitude };
      set(base);
      const place = await reverse(base).catch(() => null);
      const next = { ...base, town: place?.town, state: place?.state };
      set(next);
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify({ ...next, at: Date.now() }));
      } catch {
        // Session storage blocked: locate again next time.
      }
    },
    (err) => set({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300_000 },
  );
}

/**
 * The visitor's current town, shared by every screen. Locates on its own when
 * location permission is already granted; otherwise waits for `locate()`.
 */
export function useMyLocation() {
  const convex = useConvex();
  const loc = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => IDLE,
  );
  const reverse: Reverse = (p) => convex.action(api.geo.reverse, p);
  const locate = () => locateWith(reverse);

  useEffect(() => {
    if (checked) return;
    checked = true;
    const hit = cached();
    if (hit) {
      set(hit);
      return;
    }
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") locateWith((q) => convex.action(api.geo.reverse, q));
      })
      .catch(() => {});
  }, [convex]);

  return { loc, locate };
}
