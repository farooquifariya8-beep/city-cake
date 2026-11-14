"use client";

import Link from "next/link";
import { useConvex } from "convex/react";
import { useMemo, useState } from "react";
import { ArrowUp, CalendarRange, Info, Route } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { PlaceCard as PlaceCardData } from "@/convex/places";
import { categoryLabel } from "@/components/category/category-icon";
import { toMapPoint, useHighlight, useMapActions, useMapScene, type Scene } from "@/components/map/map-store";
import { useSheet } from "@/components/map/sheet";
import { PlaceCard } from "@/components/place/place-card";
import { ChatThread, type ThreadMessage } from "@/components/ui/chat-thread";
import { PromptSuggestions, type PromptSuggestion } from "@/components/ui/prompt-suggestions";
import { boundsOf } from "@/lib/geo";
import { photoFirst } from "@/lib/photo-first";
import { cn } from "@/lib/utils";

const SUGGESTIONS: PromptSuggestion[] = [
  { id: "maqbara", title: "Where can I eat near Bibi Ka Maqbara?", hint: "Food nearby" },
  { id: "ellora", title: "Is Ellora open on Tuesday?", hint: "Weekly closures" },
  { id: "daulatabad", title: "How long does Daulatabad Fort take?", hint: "Day trips" },
  { id: "panchakki", title: "What is Panchakki?", hint: "Sights" },
];

const STOP = new Set(["where", "what", "when", "which", "near", "open", "does", "take", "long", "from", "with", "there", "best", "time", "visit", "about", "today", "tuesday", "monday", "food", "place", "places"]);

/** Place names the message mentions, found with places.search and checked word by word. */
async function findMentions(
  query: (text: string) => Promise<PlaceCardData[]>,
  text: string,
): Promise<PlaceCardData[]> {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z]{4,}/g)?.filter((w) => !STOP.has(w)) ?? [];
  if (words.length === 0) return [];
  const results = await query(words.join(" "));
  const seen = new Set<string>();
  return photoFirst(
    results.filter((p) => {
      const nameWords = p.name.toLowerCase().match(/[a-z]{4,}/g) ?? [];
      const hit = nameWords.some((w) => !STOP.has(w) && lower.includes(w));
      if (!hit || seen.has(p._id)) return false;
      seen.add(p._id);
      return true;
    }),
  ).slice(0, 4);
}

/** The note that stands in for a reply until an assistant is connected. Never a fake answer. */
function NotConnected({ places }: { places: PlaceCardData[] }) {
  const highlight = useHighlight();
  const { setHighlight } = useMapActions();
  return (
    <div className="max-w-[340px] space-y-2.5">
      <div className="rounded-2xl bg-warn-soft px-3.5 py-3 text-[14px] leading-5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-warn uppercase">
          <Info className="size-3.5" aria-hidden /> System note
        </p>
        <p className="mt-1 text-foreground">
          The assistant isn&apos;t connected yet, so there is no answer.
          {places.length > 0 ? " The places you named are on the map." : " These work today:"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Link
            href="/plan"
            className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium ring-1 ring-hairline"
          >
            <CalendarRange className="size-3.5" aria-hidden /> Plan a trip
          </Link>
          <Link
            href={places.length > 1 ? `/map?stops=${places.map((p) => p._id).join(",")}` : "/map"}
            className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium ring-1 ring-hairline"
          >
            <Route className="size-3.5" aria-hidden /> {places.length > 1 ? "Route between them" : "Draw a route"}
          </Link>
        </div>
      </div>
      {places.length > 0 && (
        <div className="fade-x -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {places.map((p) => (
            <div key={p._id} className="w-36 shrink-0">
              <PlaceCard
                place={p}
                sizes="144px"
                meta={categoryLabel(p.category)}
                highlighted={highlight === p._id}
                onHover={setHighlight}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssistantChat() {
  const convex = useConvex();
  const { snapTo } = useSheet();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [mentioned, setMentioned] = useState<PlaceCardData[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const scene = useMemo<Scene>(
    () => ({
      points: mentioned.map(toMapPoint),
      selected: mentioned.length === 1 ? toMapPoint(mentioned[0]) : null,
      camera: mentioned.length
        ? { key: `assistant:${mentioned.map((p) => p._id).join(",")}`, bounds: boundsOf(mentioned), maxZoom: 15 }
        : null,
    }),
    [mentioned],
  );
  useMapScene(scene);

  async function send(raw: string) {
    const body = raw.trim();
    if (!body || busy) return;
    setText("");
    setBusy(true);
    let places: PlaceCardData[] = [];
    try {
      places = await findMentions((t) => convex.query(api.places.search, { text: t }), body);
    } catch {
      // Matching is a nicety; the note still shows.
    }
    const at = new Date().toISOString();
    const n = messages.length;
    setMessages((m) => [
      ...m,
      { id: `u${n}`, role: "user", content: body, at },
      { id: `n${n}`, role: "assistant", content: <NotConnected places={places} />, at, author: "City Cake" },
    ]);
    if (places.length) setMentioned(places);
    setBusy(false);
    snapTo("full");
  }

  return (
    <div className="flex min-h-full flex-col px-4 pt-2 md:pt-5">
      <h1 className="large-title">Assistant</h1>
      <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
        Ask about the city. It isn&apos;t connected yet, so you get a note instead of an answer, and
        any places you name show up on the map.
      </p>

      <div className="mt-4 flex-1">
        {messages.length === 0 ? (
          <PromptSuggestions
            data={SUGGESTIONS}
            variant="chips"
            heading="Try asking"
            onSelect={(s, prompt) => send(prompt || s.title)}
          />
        ) : (
          <ChatThread data={{ messages }} agentName="City Cake" userName="You" bare height="auto" />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="sticky bottom-0 mt-4 -mx-1 flex items-end gap-2 rounded-[22px] bg-surface p-1.5 pl-4 shadow-[0_4px_20px_rgb(0_0_0/0.08)] ring-1 ring-hairline"
      >
        <label className="sr-only" htmlFor="ask">
          Message
        </label>
        <textarea
          id="ask"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder="Ask about places, food, routes"
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send"
          className={cn(
            "press flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            text.trim() ? "bg-[var(--route)] text-white" : "bg-black/10 text-muted-foreground dark:bg-white/15",
          )}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.25} aria-hidden />
        </button>
      </form>
    </div>
  );
}
