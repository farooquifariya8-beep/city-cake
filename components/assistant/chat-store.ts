"use client";

import { useSyncExternalStore } from "react";
import type { PlaceCard } from "@/convex/places";
import type { Prefs, SavedDay } from "@/lib/plan-draft";

export type ChatPlan = { title: string; days: SavedDay[]; estCostInr: number; prefs: Prefs };

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Places the assistant returned with this reply. */
  places?: PlaceCard[];
  /** A plan the assistant made with the planner tool. */
  plan?: ChatPlan;
};

const KEY = "citycake:chat";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

let open = false;
export function setChatOpen(v: boolean) {
  open = v;
  emit();
}
export const useChatOpen = () => useSyncExternalStore(subscribe, () => open, () => false);

const EMPTY: ChatMessage[] = [];
let thread: ChatMessage[] | null = null;
function readThread(): ChatMessage[] {
  if (thread) return thread;
  if (typeof window === "undefined") return EMPTY;
  try {
    thread = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]") as ChatMessage[];
  } catch {
    thread = [];
  }
  return thread;
}
/** The conversation, kept for the browser tab's session. */
export function setThread(next: ChatMessage[]) {
  thread = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Session storage blocked: the thread lives in memory.
  }
  emit();
}
export const useThread = () => useSyncExternalStore(subscribe, readThread, () => EMPTY);
