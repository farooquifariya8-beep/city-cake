"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { SPRING_LAYOUT } from "@/lib/ease";

const LINKS = [
  ["Explore", "/explore"],
  ["Nearby", "/nearby"],
  ["Plan", "/plan"],
  ["Assistant", "/assistant"],
] as const;

/** Top links with one hover pill that glides between them. */
export function NavLinks() {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="hidden items-center sm:flex" onPointerLeave={() => setHover(null)}>
      {LINKS.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          onPointerEnter={() => setHover(href)}
          onFocus={() => setHover(href)}
          onBlur={() => setHover(null)}
          className="relative isolate inline-flex h-9 items-center rounded-full px-3.5 text-[14px] text-foreground/70 transition-colors duration-150 hover:text-foreground"
        >
          {hover === href && (
            <motion.span
              layoutId="lp-nav-pill"
              className="absolute inset-0 -z-10 rounded-full bg-black/[0.05]"
              transition={SPRING_LAYOUT}
            />
          )}
          {label}
        </Link>
      ))}
    </div>
  );
}
