"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppMenu } from "./app-menu";
import { Logo } from "./logo";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/nearby", label: "Nearby" },
  { href: "/map", label: "Map" },
  { href: "/plan", label: "Plan" },
  { href: "/assistant", label: "Assistant" },
  { href: "/saved", label: "Saved" },
];

/** Slim bar for the pages without a map. */
export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/95 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
        <Logo className="shrink-0" />
        <nav
          aria-label="Main"
          className="scrollbar-none ml-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        >
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[14px] font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-black/[0.06] text-foreground dark:bg-white/10"
                    : "text-muted-foreground hover:text-foreground",
                  // On phones the logo leads back to the map views.
                  ["/explore", "/nearby", "/map"].includes(l.href) && "hidden md:inline-flex",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <AppMenu />
      </div>
    </header>
  );
}
