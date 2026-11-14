"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUp, CalendarRange, Info, Route } from "lucide-react";
import { ChatThread, type ThreadMessage } from "@/components/ui/chat-thread";
import { PromptSuggestions, type PromptSuggestion } from "@/components/ui/prompt-suggestions";
import { cn } from "@/lib/utils";

const SUGGESTIONS: PromptSuggestion[] = [
  { id: "day", title: "What can I see in one day?", hint: "In Chhatrapati Sambhajinagar" },
  { id: "ellora", title: "Is Ellora open on Tuesday?", hint: "Weekly closures" },
  { id: "ajanta", title: "How long is the drive to Ajanta?", hint: "Day trips" },
  { id: "food", title: "Where can I eat near Bibi Ka Maqbara?", hint: "Food nearby" },
];

/** The note that stands in for a reply until an assistant is connected. Never a fake answer. */
function NotConnected() {
  return (
    <div className="max-w-sm rounded-2xl bg-warn-soft px-3.5 py-3 text-[14px] leading-5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-warn uppercase">
        <Info className="size-3.5" aria-hidden /> System note
      </p>
      <p className="mt-1 text-foreground">
        The assistant isn&apos;t connected yet, so this question has no answer. These work today:
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link
          href="/plan"
          className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium ring-1 ring-hairline"
        >
          <CalendarRange className="size-3.5" aria-hidden /> Plan a trip
        </Link>
        <Link
          href="/map"
          className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium ring-1 ring-hairline"
        >
          <Route className="size-3.5" aria-hidden /> Draw a route
        </Link>
      </div>
    </div>
  );
}

export function AssistantChat() {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");

  function send(raw: string) {
    const body = raw.trim();
    if (!body) return;
    const at = new Date().toISOString();
    const n = messages.length;
    setMessages((m) => [
      ...m,
      { id: `u${n}`, role: "user", content: body, at },
      { id: `n${n}`, role: "assistant", content: <NotConnected />, at, author: "City Cake" },
    ]);
    setText("");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-2xl flex-col">
      <div className="mb-4">
        <h1 className="large-title">Assistant</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Ask about the city. Not connected yet: questions are kept here, and a note points to the
          planner and the map.
        </p>
      </div>

      <div className="flex-1">
        {messages.length === 0 ? (
          <PromptSuggestions
            data={SUGGESTIONS}
            variant="cards"
            heading="Try asking"
            onSelect={(s, prompt) => send(prompt || s.title)}
          />
        ) : (
          <ChatThread
            data={{ messages }}
            agentName="City Cake"
            userName="You"
            bare
            height="auto"
          />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="sticky bottom-[max(env(safe-area-inset-bottom),12px)] mt-4 flex items-end gap-2 rounded-[22px] bg-surface p-1.5 pl-4 shadow-[0_4px_20px_rgb(0_0_0/0.06)] ring-1 ring-hairline"
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
          disabled={!text.trim()}
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
