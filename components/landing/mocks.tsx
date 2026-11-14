import Image from "next/image";
import { Car, Footprints, MapPin, Navigation, Search } from "lucide-react";
import { CategoryTile } from "@/components/category/category-chip";
import type { TownCard } from "./data";

// Small, static pictures of the real screens. Same names and numbers the app shows.

const frame = "w-full rounded-[20px] bg-white p-4 shadow-[0_24px_60px_-24px_rgb(60_40_10/0.3)] ring-1 ring-black/5";

const SEARCH_SAMPLE = [
  { name: "Bibi Ka Maqbara", where: "Chhatrapati Sambhajinagar", cat: "heritage" },
  { name: "Shaniwar Wada", where: "Pune, Maharashtra", cat: "heritage" },
  { name: "Gateway of India", where: "Mumbai, Maharashtra", cat: "attraction" },
];

export function SearchMock() {
  return (
    <div className={frame}>
      <div className="flex h-11 items-center gap-2 rounded-full bg-[oklch(0.965_0.01_85)] px-4 ring-1 ring-black/5">
        <Search className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        <span className="text-[14px]">wada</span>
        <span className="h-4 w-px bg-[var(--route)]" />
      </div>
      <ul className="mt-3 space-y-1.5">
        {SEARCH_SAMPLE.map((s) => (
          <li key={s.name} className="flex items-center gap-3 rounded-xl px-2 py-2 odd:bg-[oklch(0.975_0.008_85)]">
            <CategoryTile category={s.cat} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[14px] font-medium">{s.name}</p>
              <p className="truncate text-[12px] text-muted-foreground">{s.where}</p>
            </div>
            <MapPin className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}

const PLAN_SAMPLE = [
  { t: "09:00", name: "Soneri Mahal", cat: "heritage", d: "1 h 30" },
  { t: "10:35", name: "Aurangabad Caves", cat: "heritage", d: "1 h 30" },
  { t: "12:15", name: "Bhadkal Gate", cat: "heritage", d: "1 h 30" },
  { t: "13:50", name: "Great Sagar Restaurant", cat: "food", d: "1 h" },
];

export function PlanMock() {
  return (
    <div className={frame}>
      <div className="mb-3 flex gap-1.5 text-[12px] font-medium">
        <span className="rounded-full bg-[var(--lp-ink)] px-3 py-1 text-white">Day 1</span>
        <span className="rounded-full px-3 py-1 text-muted-foreground ring-1 ring-black/10">Day 2 · Ellora</span>
      </div>
      <ol className="space-y-1.5">
        {PLAN_SAMPLE.map((s) => (
          <li key={s.name} className="flex items-center gap-3 rounded-xl bg-[oklch(0.975_0.008_85)] px-3 py-2 ring-1 ring-black/5">
            <span className="w-11 text-[13px] font-medium tabular-nums">{s.t}</span>
            <CategoryTile category={s.cat} size="sm" />
            <span className="min-w-0 flex-1 truncate text-[14px]">{s.name}</span>
            <span className="text-[12px] text-muted-foreground tabular-nums">{s.d}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const NEARBY_SAMPLE = [
  { name: "Govt Medical College & Hospital", cat: "hospital", m: "410 m" },
  { name: "HDFC ATM", cat: "atm", m: "530 m" },
  { name: "Shri Sai Hospital and Research Centre", cat: "hospital", m: "590 m" },
  { name: "Bank of Maharashtra", cat: "atm", m: "600 m" },
];

export function NearbyMock() {
  return (
    <div className={frame}>
      <p className="px-1 pb-2 text-[12px] font-medium text-muted-foreground">Closest to you</p>
      <ul className="divide-y divide-black/5">
        {NEARBY_SAMPLE.map((n) => (
          <li key={n.name} className="flex items-center gap-3 px-1 py-2.5">
            <CategoryTile category={n.cat} size="sm" />
            <span className="min-w-0 flex-1 truncate text-[14px]">{n.name}</span>
            <span className="text-[12px] text-muted-foreground tabular-nums">{n.m}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatMock() {
  return (
    <div className={`${frame} space-y-2`}>
      <p className="ml-auto w-fit max-w-[82%] rounded-[18px] rounded-br-md bg-[var(--lp-ink)] px-3.5 py-2 text-[14px] text-white">
        Is Ellora open on Tuesday?
      </p>
      <p className="w-fit max-w-[90%] rounded-[18px] rounded-bl-md bg-[oklch(0.965_0.01_85)] px-3.5 py-2 text-[14px] leading-snug">
        No. The Ellora caves close on Tuesdays. Daulatabad fort is open, 16 km from the city, so you could go there
        instead and see Ellora on Wednesday.
      </p>
      <p className="w-fit rounded-full px-1 pt-1 text-[12px] text-muted-foreground">
        Checked against the places and opening days in this guide
      </p>
    </div>
  );
}

export function RouteMock({ ellora }: { ellora?: TownCard }) {
  return (
    <div className="relative h-[260px] w-full overflow-hidden rounded-[20px] bg-[oklch(0.95_0.025_115)] shadow-[0_24px_60px_-24px_rgb(60_40_10/0.3)] ring-1 ring-black/5">
      <svg viewBox="0 0 400 260" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <path d="M0 190 C80 170 120 210 200 180 S330 120 400 140" stroke="oklch(0.89 0.03 90)" strokeWidth="16" fill="none" />
        <path d="M40 40 C120 80 160 60 220 110 S330 200 390 240" stroke="oklch(0.91 0.02 90)" strokeWidth="10" fill="none" />
        <path d="M250 0 C240 60 280 100 260 160 S300 230 290 260" stroke="oklch(0.85 0.05 220)" strokeWidth="6" fill="none" />
        <path
          d="M70 200 C120 150 150 165 190 140 S280 90 330 70"
          stroke="var(--route)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          pathLength={1}
          className="lp-draw"
        />
        <circle cx="70" cy="200" r="8" fill="white" stroke="var(--route)" strokeWidth="4" />
      </svg>
      <span className="absolute top-[22%] left-[82.5%] flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(0.62_0.13_70)] text-white ring-[3px] ring-white">
        <Navigation className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="absolute top-3 left-3 flex gap-1 rounded-full bg-white/95 p-1 text-[12px] font-medium shadow-sm">
        <span className="flex items-center gap-1 rounded-full bg-[var(--lp-ink)] px-2.5 py-1 text-white">
          <Car className="size-3.5" aria-hidden /> Drive
        </span>
        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-muted-foreground">
          <Footprints className="size-3.5" aria-hidden /> Walk
        </span>
      </div>
      <div className="absolute right-3 bottom-3 left-3 flex items-center gap-3 rounded-2xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
        {ellora?.photo ? (
          <span className="relative size-9 shrink-0 overflow-hidden rounded-lg">
            <Image src={ellora.photo.url} alt="" fill sizes="36px" className="object-cover" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">City centre to Ellora Caves</p>
          <p className="text-[12px] text-muted-foreground tabular-nums">{ellora?.distanceKm ?? 29} km · driving</p>
        </div>
      </div>
    </div>
  );
}
