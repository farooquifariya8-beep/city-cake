"use client";

import Lenis from "lenis";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { EASE_OUT } from "@/lib/ease";

/**
 * Lenis smooth scrolling for the landing page only. Lenis drives the native
 * window scroll, so motion's useScroll keeps working. Skipped entirely when
 * the visitor asks for reduced motion, and torn down when the page unmounts.
 */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.11, anchors: true });
    return () => lenis.destroy();
  }, [reduce]);
  return null;
}

/** Fades and lifts its content in once it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.8, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}
