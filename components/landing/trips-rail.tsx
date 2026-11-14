"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CategoryTile } from "@/components/category/category-chip";
import type { TownCard } from "./data";

/**
 * Day trips. On wide screens the section pins and vertical scrolling moves the
 * rail sideways, nearest town first. On phones, and with reduced motion, it is
 * a plain swipeable rail.
 */
export function TripsRail({ trips }: { trips: TownCard[] }) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [travel, setTravel] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const measure = () => {
      const track = trackRef.current;
      const on = mq.matches && !reduce;
      setPinned(on);
      setTravel(on && track ? Math.max(0, track.scrollWidth - window.innerWidth) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    mq.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [reduce]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -travel]);
  const bar = useTransform(scrollYProgress, [0, 1], [0.06, 1]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="trips-title"
      className="relative"
      style={pinned ? { height: `calc(100vh + ${travel}px)` } : undefined}
    >
      <div className={pinned ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden" : "pt-20"}>
        <div className="mx-auto flex w-full max-w-[1240px] items-end justify-between gap-6 px-5 md:px-8">
          <div>
            <p className="text-[13px] font-medium tracking-[0.08em] text-[oklch(0.5_0.1_70)] uppercase">Day trips</p>
            <h2
              id="trips-title"
              className="mt-2 text-[32px] leading-[1.05] font-semibold tracking-[-0.025em] text-balance md:text-[44px]"
            >
              Caves, a fort and a crater, a few hours out
            </h2>
          </div>
          <Link
            href="/explore"
            className="group hidden shrink-0 items-center gap-1 text-[15px] font-medium text-[var(--route)] sm:inline-flex"
          >
            See all places
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>

        <div className={pinned ? "mt-10" : "mt-8"}>
          <motion.ul
            ref={trackRef}
            style={pinned ? { x } : undefined}
            className={
              pinned
                ? "flex w-max gap-5 pr-8 pl-[max(2rem,calc((100vw-1240px)/2+2rem))]"
                : "fade-x flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none]"
            }
          >
            {trips.map((t, i) => (
              <li key={t.slug} className="w-[78vw] max-w-[300px] shrink-0 snap-start md:w-[320px] md:max-w-none">
                <TripCard town={t} index={i} />
              </li>
            ))}
          </motion.ul>
        </div>

        {pinned && (
          <div className="mx-auto mt-10 w-full max-w-[1240px] px-8">
            <div className="h-[3px] w-40 overflow-hidden rounded-full bg-black/[0.07]">
              <motion.div style={{ scaleX: bar }} className="h-full origin-left rounded-full bg-[var(--lp-ink)]" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TripCard({ town, index }: { town: TownCard; index: number }) {
  return (
    <Link href={`/explore?city=${town.slug}`} className="group block outline-none">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-[oklch(0.93_0.02_80)] ring-1 ring-black/5 ring-inset transition-shadow duration-300 group-hover:shadow-[0_24px_48px_-16px_rgb(60_40_10/0.35)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--route)]">
        {town.photo ? (
          <Image
            src={town.photo.url}
            alt={`${town.photo.placeName}, ${town.name}`}
            fill
            sizes="(min-width: 768px) 320px, 78vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CategoryTile category="attraction" size="lg" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgb(0_0_0/0.55),transparent)]" />
        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-medium tabular-nums shadow-sm">
          {town.distanceKm} km
        </span>
        <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/95 opacity-0 shadow-sm transition-[opacity,transform] duration-300 group-hover:opacity-100 group-hover:rotate-0 rotate-[-30deg]">
          <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="absolute right-4 bottom-4 left-4 text-white">
          <p className="text-[12px] font-medium text-white/70 tabular-nums">{String(index + 1).padStart(2, "0")}</p>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <h3 className="text-[20px] font-semibold tracking-[-0.015em]">{town.name}</h3>
            <span className="shrink-0 text-[13px] text-white/80" lang="mr">
              {town.localName}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[14.5px] leading-snug text-pretty text-muted-foreground">{town.blurb}</p>
    </Link>
  );
}
