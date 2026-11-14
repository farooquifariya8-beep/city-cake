"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Compass, LocateFixed, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING } from "./segmented";

const TABS = [
  { href: "/explore", label: "Explore", icon: Compass, match: ["/explore", "/place"] },
  { href: "/nearby", label: "Nearby", icon: LocateFixed, match: ["/nearby"] },
  { href: "/map", label: "Map", icon: Route, match: ["/map"] },
] as const;

/** The segmented nav between the three map views. */
export function NavTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Map views"
      className={cn(
        "flex items-center rounded-[12px] bg-black/[0.055] p-0.5 dark:bg-white/10",
        className,
      )}
    >
      {TABS.map((t) => {
        const active = t.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-thumb"
                transition={SPRING}
                className="absolute inset-0 rounded-[10px] bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-white/20"
              />
            )}
            <Icon className="relative size-4" strokeWidth={1.75} aria-hidden />
            <span className="relative">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
