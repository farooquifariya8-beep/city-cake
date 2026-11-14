"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type FeatureItem = {
  key: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  /** Soft regional tint behind the preview. */
  tint: string;
  preview: React.ReactNode;
};

/**
 * One feature per screen of scrolling. On wide screens the preview on the
 * right stays put and changes to match the step in view. On phones each step
 * carries its own preview.
 */
export function Features({ items }: { items: FeatureItem[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const current = items[active];

  return (
    <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-16 md:px-8">
      <ol className="md:pb-[20vh]">
        {items.map((f, i) => (
          <Step key={f.key} item={f} index={i} active={active === i} onActive={() => setActive(i)} />
        ))}
      </ol>

      <div className="relative hidden md:block">
        <div
          className="sticky top-[calc(50vh-230px)] flex h-[460px] items-center rounded-[32px] px-10 transition-colors duration-700"
          style={{ backgroundColor: current.tint }}
        >
          {/* Index rail: one dot per step, the active one stretched. */}
          <div className="absolute top-1/2 -left-6 flex -translate-y-1/2 flex-col gap-2" aria-hidden>
            {items.map((f, i) => (
              <span
                key={f.key}
                className={cn(
                  "w-1.5 rounded-full transition-all duration-500",
                  i === active ? "h-6 bg-[var(--lp-ink)]" : "h-1.5 bg-black/15",
                )}
              />
            ))}
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={current.key}
              className="w-full"
              initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -40, scale: 0.97, filter: "blur(8px)" }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              {current.preview}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Step({
  item,
  index,
  active,
  onActive,
}: {
  item: FeatureItem;
  index: number;
  active: boolean;
  onActive: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive();
  }, [inView, onActive]);

  return (
    <li
      ref={ref}
      className={cn(
        "flex flex-col justify-center py-10 transition-opacity duration-500 md:min-h-[72vh] md:py-0",
        active ? "md:opacity-100" : "md:opacity-35",
      )}
    >
      <p className="flex items-center gap-3 text-[13px] font-medium text-muted-foreground tabular-nums">
        <span className="text-[var(--lp-ink)]">{String(index + 1).padStart(2, "0")}</span>
        <span className="h-px w-8 bg-black/15" />
        {item.kicker}
      </p>
      <h3 className="mt-4 max-w-[16ch] text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance md:text-[40px]">
        {item.title}
      </h3>
      <p className="mt-4 max-w-[44ch] text-[16.5px] leading-relaxed text-pretty text-muted-foreground">{item.body}</p>
      <Link
        href={item.href}
        className="group mt-6 inline-flex w-fit items-center gap-1.5 text-[15px] font-medium text-[var(--route)]"
      >
        {item.cta}
        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
      </Link>
      <div className="mt-8 rounded-[28px] p-4 md:hidden" style={{ backgroundColor: item.tint }}>
        {item.preview}
      </div>
    </li>
  );
}
