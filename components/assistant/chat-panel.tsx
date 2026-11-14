"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, MessageCircle, Plus, RotateCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PlaceCard } from "@/convex/places";
import { categoryLabel } from "@/components/category/category-icon";
import { PlaceImage } from "@/components/place/place-image";
import { SPRING } from "@/components/shell/segmented";
import { cityBySlug } from "@/lib/geo";
import { addStop, useDraft } from "@/lib/plan-draft";
import { cn } from "@/lib/utils";
import { setChatOpen, setThread, useChatOpen, useThread, type ChatMessage } from "./chat-store";

const SUGGESTIONS = [
  "What should I see in one day here?",
  "Is Ellora open on Tuesday?",
  "Where can I eat near Bibi Ka Maqbara?",
  "How long is the drive to Ajanta?",
];


/** Bold, bullet and numbered lists, paragraphs. Enough for the replies. */
function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cn("my-1 space-y-0.5 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const num = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(
      <p key={blocks.length} className={cn("my-1", heading && "font-semibold")}>
        {inline(heading ? heading[1] : line)}
      </p>,
    );
  }
  flush();
  return <div className="text-[14.5px] leading-[1.45]">{blocks}</div>;
}

function PlaceChip({ place }: { place: PlaceCard }) {
  const draft = useDraft();
  return (
    <div className="flex w-44 shrink-0 items-center gap-2 rounded-2xl bg-surface p-1.5 pr-1 ring-1 ring-hairline">
      <Link href={`/place/${place._id}`} className="flex min-w-0 flex-1 items-center gap-2" onClick={() => window.innerWidth < 768 && setChatOpen(false)}>
        <PlaceImage src={place.image} alt="" category={place.category} ratio="1/1" width={330} sizes="40px" className="size-10 shrink-0 rounded-xl" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] leading-4 font-medium">{place.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{categoryLabel(place.category)}</span>
        </span>
      </Link>
      <button
        type="button"
        aria-label={`Add ${place.name} to day ${draft.activeDay + 1} of your plan`}
        title={`Add to day ${draft.activeDay + 1}`}
        onClick={() => {
          addStop(draft.activeDay, { placeId: place._id, name: place.name, category: place.category, lat: place.lat, lng: place.lng });
          toast(`Added ${place.name} to day ${draft.activeDay + 1}`);
        }}
        className="press flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--route)]/10 text-[var(--route)] hover:bg-[var(--route)]/20"
      >
        <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

function Conversation({ onClose, mobile }: { onClose: () => void; mobile: boolean }) {
  const thread = useThread();
  const chat = useAction(api.assistant.chat);
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<false | string>(false);
  const end = useRef<HTMLDivElement>(null);

  const focusPlaceId = /^\/place\/([^/]+)/.exec(pathname)?.[1] as Id<"places"> | undefined;
  const citySlug = cityBySlug(params.get("city")).slug;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [thread.length, pending, failed]);

  async function ask(messages: ChatMessage[]) {
    setPending(true);
    setFailed(false);
    try {
      const res = await chat({
        messages: messages.map(({ role, content }) => ({ role, content })),
        citySlug,
        focusPlaceId,
      });
      setThread([...messages, { role: "assistant", content: res.reply, places: res.places.slice(0, 6) }]);
    } catch (err) {
      setFailed(
        String((err as Error)?.message ?? err).includes("ASSISTANT_BUSY")
          ? "The assistant is busy. Try again in a minute"
          : "Couldn't reach the assistant. Try again",
      );
    } finally {
      setPending(false);
    }
  }

  function send(raw: string) {
    const body = raw.trim();
    if (!body || pending) return;
    setText("");
    const next: ChatMessage[] = [...thread, { role: "user", content: body }];
    setThread(next);
    void ask(next);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--route)] text-white">
          <MessageCircle className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-5 font-semibold">Assistant</p>
          <p className="truncate text-[12px] text-muted-foreground">
            Answers from the places in this guide{focusPlaceId ? ", about this place" : ""}
          </p>
        </div>
        {thread.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setThread([]);
              setFailed(false);
            }}
            aria-label="Clear the conversation"
            title="New conversation"
            className="press flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the assistant"
          className="press flex size-8 items-center justify-center rounded-full bg-black/[0.055] hover:bg-black/10 dark:bg-white/10"
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
        {thread.length === 0 ? (
          <div className="pt-6">
            <p className="text-[20px] leading-tight font-semibold tracking-tight">Ask about the city</p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Places, opening days, food nearby, how long things take.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="press rounded-2xl bg-surface px-3.5 py-2 text-left text-[14px] ring-1 ring-hairline hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {thread.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-[20px] rounded-br-md bg-[var(--route)] px-3.5 py-2 text-[14.5px] leading-[1.4] whitespace-pre-wrap text-white">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="space-y-2">
                  <div className="max-w-[92%] rounded-[20px] rounded-bl-md bg-surface px-3.5 py-2 ring-1 ring-hairline">
                    <Markdown text={m.content} />
                  </div>
                  {m.places && m.places.length > 0 && (
                    <div className="fade-x -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                      {m.places.map((p) => (
                        <PlaceChip key={p._id} place={p} />
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {pending && (
              <div className="flex w-fit items-center gap-1 rounded-[20px] rounded-bl-md bg-surface px-4 py-3 ring-1 ring-hairline" role="status" aria-label="The assistant is typing">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="size-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                  />
                ))}
              </div>
            )}
            {failed && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">
                {failed}
                <button
                  type="button"
                  onClick={() => ask(thread)}
                  className="press inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-3 py-1 text-[13px] font-medium text-foreground ring-1 ring-hairline"
                >
                  <RotateCw className="size-3.5" aria-hidden /> Retry
                </button>
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className={cn(
          "mx-3 mb-3 flex shrink-0 items-end gap-2 rounded-[22px] bg-surface p-1.5 pl-4 ring-1 ring-hairline",
          mobile && "mb-[max(env(safe-area-inset-bottom),12px)]",
        )}
      >
        <label className="sr-only" htmlFor={mobile ? "ask-m" : "ask-d"}>
          Message
        </label>
        <textarea
          id={mobile ? "ask-m" : "ask-d"}
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
          className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-2 text-[16px] outline-none placeholder:text-muted-foreground md:text-[15px] [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Send"
          className={cn(
            "press flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            text.trim() && !pending ? "bg-[var(--route)] text-white" : "bg-black/10 text-muted-foreground dark:bg-white/15",
          )}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.25} aria-hidden />
        </button>
      </form>
    </div>
  );
}

/**
 * The assistant on every map view. Desktop: a corner button and a floating
 * panel. Mobile: a full-screen sheet opened from the top control.
 */
export function ChatDock() {
  const open = useChatOpen();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("chat") === "1") setChatOpen(true);
  }, [params]);

  return (
    <>
      {/* Desktop */}
      <div className="pointer-events-none absolute right-3 bottom-3 z-30 hidden md:block">
        <AnimatePresence>
          {open && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={SPRING}
              style={{ transformOrigin: "bottom right" }}
              className="material pointer-events-auto absolute right-0 bottom-0 h-[min(560px,calc(100dvh-24px))] w-[380px] overflow-hidden rounded-[20px]"
            >
              <Conversation onClose={() => setChatOpen(false)} mobile={false} />
            </motion.div>
          )}
        </AnimatePresence>
        {!open && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label="Open the assistant"
            className="material press pointer-events-auto flex size-12 items-center justify-center rounded-full text-[var(--route)]"
          >
            <MessageCircle className="size-[22px]" strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      {/* Mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) setChatOpen(false);
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] flex-col rounded-t-3xl bg-background pt-[env(safe-area-inset-top)] shadow-[0_-8px_32px_rgb(0_0_0/0.15)] md:hidden"
            role="dialog"
            aria-label="Assistant"
          >
            <div className="flex h-5 shrink-0 cursor-grab items-center justify-center" aria-hidden>
              <span className="h-[5px] w-9 rounded-full bg-black/20 dark:bg-white/25" />
            </div>
            <div className="min-h-0 flex-1" onPointerDownCapture={(e) => e.stopPropagation()}>
              <Conversation onClose={() => setChatOpen(false)} mobile />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
