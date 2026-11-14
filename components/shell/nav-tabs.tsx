"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarRange, Compass, Heart, LocateFixed, Map as MapIcon, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { setChatOpen, useChatOpen } from "@/components/assistant/chat-store";
import { AppMenu } from "./app-menu";
import { SPRING } from "./segmented";

const TABS = [
  { href: "/explore", label: "Explore", icon: Compass, match: ["/explore", "/place"] },
  { href: "/nearby", label: "Nearby", icon: LocateFixed, match: ["/nearby"] },
  { href: "/map", label: "Map", icon: MapIcon, match: ["/map"] },
  { href: "/plan", label: "Plan", icon: CalendarRange, match: ["/plan"] },
  { href: "/saved", label: "Saved", icon: Heart, match: ["/saved"] },
] as const;

/** The five places to go, always visible, as an iOS-style tab strip. */
export function NavTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cn("flex items-center rounded-[14px] bg-black/[0.055] p-0.5 dark:bg-white/10", className)}
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
              "relative flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] text-[11px] leading-none font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-thumb"
                transition={SPRING}
                className="absolute inset-0 rounded-[12px] bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-white/20"
              />
            )}
            <Icon className="relative size-[18px]" strokeWidth={active ? 2.1 : 1.75} aria-hidden />
            <span className="relative">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Tabs, then the assistant and account buttons. Shared by both shells. */
export function HeaderControls({ onMap = false }: { onMap?: boolean }) {
  const chatOpen = useChatOpen();
  const onAssistant = onMap && chatOpen;
  const cls = cn(
          "press inline-flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          onAssistant
            ? "bg-[var(--route)] text-white"
            : "bg-black/[0.055] text-foreground hover:bg-black/10 dark:bg-white/10",
        // On the map the desktop has a corner button; the icon is for phones.
        onMap && "md:hidden",
      );
  const icon = <MessageCircle className="size-[18px]" strokeWidth={1.75} aria-hidden />;
  return (
    <>
      <NavTabs className="min-w-0 flex-1" />
      {onMap ? (
        <button type="button" aria-label="Assistant" title="Assistant" aria-pressed={chatOpen} onClick={() => setChatOpen(!chatOpen)} className={cls}>
          {icon}
        </button>
      ) : (
        <Link href="/explore?chat=1" aria-label="Assistant" title="Assistant" className={cls}>
          {icon}
        </Link>
      )}
      <AppMenu />
    </>
  );
}
