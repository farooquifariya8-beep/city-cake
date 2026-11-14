"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Car, MapPin } from "lucide-react";
import type { TownCard } from "./data";
import { cn } from "@/lib/utils";

/**
 * Three real photos and three small cards from the app, layered. As the page
 * scrolls, each layer drifts at its own rate so the collage gains depth.
 */
export function HeroCollage({ home, ellora, daulatabad }: { home?: TownCard; ellora?: TownCard; daulatabad?: TownCard }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const rate = (to: number) => [0, reduce ? 0 : to];
  const yMain = useTransform(scrollY, [0, 700], rate(-40));
  const yTop = useTransform(scrollY, [0, 700], rate(-120));
  const yLow = useTransform(scrollY, [0, 700], rate(-70));
  const yPin = useTransform(scrollY, [0, 700], rate(-170));
  const yRoute = useTransform(scrollY, [0, 700], rate(-20));
  const yChat = useTransform(scrollY, [0, 700], rate(-140));
  const scale = useTransform(scrollY, [0, 700], [1, reduce ? 1 : 0.94]);

  return (
    <motion.div style={{ scale }} className="relative mx-auto aspect-[1/1.04] w-full max-w-[600px] origin-top">
      <Layer y={yMain} className="top-[7%] left-0 w-[57%]" delay={80}>
        <Photo town={home} className="aspect-[3/4]" sizes="(min-width: 1024px) 340px, 57vw" priority />
      </Layer>
      <Layer y={yTop} className="top-0 right-0 w-[40%]" delay={200}>
        <Photo town={ellora} className="aspect-[4/5]" sizes="(min-width: 1024px) 240px, 40vw" />
      </Layer>
      <Layer y={yLow} className="right-[5%] bottom-[2%] w-[37%]" delay={320}>
        <Photo town={daulatabad} className="aspect-square" sizes="(min-width: 1024px) 220px, 37vw" />
      </Layer>

      {/* A selected place, the way the map shows it. */}
      <Layer y={yPin} className="top-[2%] left-[-2%] sm:left-[-5%]" delay={520}>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/95 py-2 pr-4 pl-2 shadow-[0_8px_32px_rgb(60_40_10/0.14)] ring-1 ring-black/5">
          <span className="flex size-7 items-center justify-center rounded-full bg-[var(--route)] text-white">
            <MapPin className="size-3.5" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-[13.5px] font-semibold">{home?.photo?.placeName ?? "Bibi Ka Maqbara"}</p>
            <p className="text-[12px] text-muted-foreground">Chhatrapati Sambhajinagar</p>
          </div>
        </div>
      </Layer>

      {/* A route. */}
      <Layer y={yRoute} className="bottom-[9%] left-[4%] sm:left-[8%]" delay={640}>
        <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-[0_8px_32px_rgb(60_40_10/0.14)] ring-1 ring-black/5">
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--route)] text-white">
            <Car className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-[13.5px] font-semibold">To Ellora Caves</p>
            <p className="text-[12px] text-muted-foreground tabular-nums">{ellora?.distanceKm ?? 29} km by road</p>
          </div>
        </div>
      </Layer>

      {/* A question for the assistant. */}
      <Layer y={yChat} className="top-[52%] right-[-1%] sm:right-[-4%]" delay={760}>
        <p className="max-w-[200px] rounded-[18px] rounded-br-md bg-[var(--lp-ink)] px-3.5 py-2 text-[13.5px] leading-snug text-white shadow-[0_8px_32px_rgb(60_40_10/0.18)]">
          Is Ellora open on Tuesday?
        </p>
      </Layer>
    </motion.div>
  );
}

function Layer({
  y,
  className,
  delay,
  children,
}: {
  y: MotionValue<number>;
  className: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div style={{ y }} className={cn("absolute", className)}>
      <div className="lp-settle" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
        {children}
      </div>
    </motion.div>
  );
}

function Photo({
  town,
  className,
  sizes,
  priority,
}: {
  town?: TownCard;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] bg-[oklch(0.93_0.02_80)] shadow-[0_18px_48px_-12px_rgb(60_40_10/0.28)] ring-1 ring-black/5 ring-inset sm:rounded-[26px]",
        className,
      )}
    >
      {town?.photo ? (
        <Image
          src={town.photo.url}
          alt={`${town.photo.placeName}, ${town.name}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : null}
      {town && (
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur sm:bottom-3 sm:left-3 sm:text-[12px]">
          {town.name}
        </span>
      )}
    </div>
  );
}
