import Link from "next/link";
import { LogoMark } from "./logo";
import { HeaderControls } from "./nav-tabs";

/** Slim bar for the pages without a map: the same controls as the map shell. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/95 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-2 px-3 md:gap-3 md:px-4">
        <Link
          href="/explore"
          aria-label="City, go to explore"
          className="hidden shrink-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
        >
          <LogoMark />
          <span className="hidden text-[15px] font-semibold tracking-tight md:inline">City</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2 md:mx-auto md:max-w-[460px]">
          <HeaderControls />
        </div>
      </div>
    </header>
  );
}
