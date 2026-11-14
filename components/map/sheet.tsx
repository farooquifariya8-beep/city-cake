"use client";

import { animate, useMotionValue, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { SPRING } from "@/components/shell/segmented";
import { useMapActions } from "./map-store";

type Snap = "peek" | "half" | "full";
const PEEK = 148;

const SheetContext = createContext<{ snapTo: (s: Snap) => void }>({ snapTo: () => {} });
export const useSheet = () => useContext(SheetContext);

function snapHeights(vh: number): Record<Snap, number> {
  return { peek: PEEK, half: Math.round(vh * 0.48), full: vh - 84 };
}

/**
 * The floating sheet. Desktop: a frosted panel on the left. Mobile: a bottom
 * sheet with three heights, dragged by its handle.
 */
export function MapSheet({ children }: { children: ReactNode }) {
  const { bus } = useMapActions();
  const height = useMotionValue(0);
  const [vh, setVh] = useState<number | null>(null);
  const [desktop, setDesktop] = useState(false);
  const snap = useRef<Snap>("half");
  const scroller = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      setDesktop(mq.matches);
      setVh(window.innerHeight);
      const h = snapHeights(window.innerHeight)[snap.current];
      height.set(h);
      bus.setInset(mq.matches ? 0 : h);
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [height, bus]);

  useEffect(() => height.on("change", (h) => bus.setInset(desktop ? 0 : h)), [height, bus, desktop]);

  // A new page starts at the top of the sheet.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const snapTo = useCallback(
    (s: Snap) => {
      if (!vh) return;
      snap.current = s;
      animate(height, snapHeights(vh)[s], SPRING);
    },
    [vh, height],
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (desktop || !vh) return;
    const heights = snapHeights(vh);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startH = height.get();
    let lastY = startY;
    let lastT = performance.now();
    let velocity = 0;
    let moved = false;

    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (Math.abs(dy) > 4) moved = true;
      const now = performance.now();
      velocity = (ev.clientY - lastY) / Math.max(1, now - lastT);
      lastY = ev.clientY;
      lastT = now;
      height.set(Math.min(heights.full, Math.max(PEEK * 0.75, startH - dy)));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      if (!moved) {
        snapTo(snap.current === "full" ? "half" : snap.current === "half" ? "full" : "half");
        return;
      }
      const projected = height.get() - velocity * 180;
      const order: Snap[] = ["peek", "half", "full"];
      const nearest = order.reduce((a, b) =>
        Math.abs(heights[b] - projected) < Math.abs(heights[a] - projected) ? b : a,
      );
      snapTo(nearest);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  return (
    <SheetContext.Provider value={{ snapTo }}>
      <motion.section
        aria-label="Places"
        style={vh && !desktop ? { height } : undefined}
        className="material fixed inset-x-0 bottom-0 z-20 flex h-[48dvh] flex-col overflow-hidden rounded-t-3xl md:absolute md:top-[84px] md:bottom-3 md:left-3 md:h-auto! md:w-[400px] md:rounded-3xl"
      >
        <div
          onPointerDown={onPointerDown}
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
          aria-hidden
        >
          <span className="h-[5px] w-9 rounded-full bg-black/20 dark:bg-white/25" />
        </div>
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),16px)]"
        >
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </motion.section>
    </SheetContext.Provider>
  );
}
