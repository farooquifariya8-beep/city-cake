import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  MapPin,
  Navigation,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/shell/logo";
import { CategoryTile } from "@/components/category/category-chip";
import { NumberTicker } from "@/components/motion/number-ticker";
import { HeroSearch } from "@/components/landing/hero-search";
import { getLandingData, type TownCard } from "@/components/landing/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "City Cake: a guide to Chhatrapati Sambhajinagar, Ellora and Ajanta",
};

const QUICK = [
  { label: "Heritage", href: "/explore?cat=heritage", cat: "heritage" },
  { label: "Food", href: "/explore?cat=food", cat: "food" },
  { label: "Hospitals", href: "/nearby?cat=hospital", cat: "hospital" },
  { label: "ATMs", href: "/nearby?cat=atm", cat: "atm" },
];

export default async function Home() {
  const { towns, places, facilities } = await getLandingData();
  const home = towns.find((t) => t.kind === "home") ?? towns[0];
  const ellora = towns.find((t) => t.slug === "ellora");
  const daulatabad = towns.find((t) => t.slug === "daulatabad");
  const trips = towns.filter((t) => t.kind === "daytrip");

  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-background">
      <Nav />

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 pt-8 pb-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-16 lg:pb-24">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[13px] text-muted-foreground ring-1 ring-hairline">
            <MapPin className="size-3.5 text-[var(--route)]" strokeWidth={2} aria-hidden />
            City guide for Maharashtra&apos;s Deccan
          </p>
          <h1 className="mt-5 text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance sm:text-[56px] lg:text-[64px]">
            Find your way around Chhatrapati Sambhajinagar
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-pretty text-muted-foreground">
            Places to see, the nearest pharmacy, routes on a map and a plan for each day. For the city and
            its day trips to Ellora, Daulatabad and Ajanta.
          </p>
          <div className="mt-8">
            <HeroSearch />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="press inline-flex h-9 items-center gap-2 rounded-full bg-surface pr-3.5 pl-1.5 text-[14px] ring-1 ring-hairline transition-colors hover:bg-accent"
              >
                <CategoryTile category={q.cat} size="sm" className="size-6 rounded-full" />
                {q.label}
              </Link>
            ))}
          </div>
        </div>

        <HeroCollage home={home} ellora={ellora} daulatabad={daulatabad} />
      </section>

      {/* Numbers */}
      <section className="border-y border-hairline bg-surface">
        <dl className="mx-auto grid w-full max-w-[1240px] grid-cols-2 gap-y-6 px-5 py-8 md:grid-cols-4 md:px-8">
          <Stat value={places} label="places to see" />
          <Stat value={facilities} label="hospitals, ATMs, pharmacies and more" />
          <Stat value={towns.length} label="towns covered" />
          <Stat value={0} label="sign-ups needed to browse" />
        </dl>
      </section>

      {/* Day trips */}
      <section className="mx-auto w-full max-w-[1240px] px-5 pt-20 md:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] md:text-[38px]">
              Day trips from the city
            </h2>
            <p className="mt-2 max-w-[52ch] text-[16px] text-muted-foreground">
              Rock-cut caves, a hilltop fort and a meteorite crater, all within a few hours by road.
            </p>
          </div>
          <Link
            href="/explore"
            className="hidden shrink-0 items-center gap-1 text-[15px] font-medium text-[var(--route)] sm:inline-flex"
          >
            See all places <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul className="fade-x -mx-5 mt-8 flex snap-x gap-4 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8">
          {trips.map((t) => (
            <li key={t.slug} className="w-[260px] shrink-0 snap-start sm:w-[280px]">
              <TripCard town={t} />
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-[1240px] px-5 pt-24 md:px-8">
        <h2 className="max-w-[20ch] text-[30px] leading-tight font-semibold tracking-[-0.02em] text-balance md:text-[38px]">
          Everything for the trip in one place
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-6">
          <Feature
            className="md:col-span-4"
            href="/plan"
            title="Plan your days"
            body="Build each day yourself from any place in India, or start from a suggested plan and change it."
          >
            <PlanMock />
          </Feature>
          <Feature
            className="md:col-span-2"
            href="/nearby"
            title="What's near you"
            body="The closest hospital, pharmacy, ATM or bus stand, sorted by distance."
          >
            <NearbyMock />
          </Feature>
          <Feature
            className="md:col-span-3"
            href="/explore?chat=1"
            title="Ask the assistant"
            body="It looks up places, opening days and real road times before it answers."
          >
            <ChatMock />
          </Feature>
          <Feature
            className="md:col-span-3"
            href="/map"
            title="Routes on a 3D map"
            body="Pick stops, switch between driving and walking, and see the route over the terrain."
          >
            <RouteMock ellora={ellora} />
          </Feature>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto w-full max-w-[1240px] px-5 py-24 md:px-8">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-[oklch(0.22_0.01_260)] text-white">
          {ellora?.photo && (
            <Image
              src={ellora.photo.url}
              alt=""
              fill
              sizes="(min-width: 1240px) 1240px, 100vw"
              className="-z-10 object-cover opacity-55"
            />
          )}
          <div className="-z-10 absolute inset-0 bg-[linear-gradient(90deg,rgb(0_0_0/0.72),rgb(0_0_0/0.15))]" />
          <div className="max-w-[560px] px-7 py-14 md:px-12 md:py-20">
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] text-balance md:text-[44px]">
              Open the map and start with what&apos;s close
            </h2>
            <p className="mt-3 text-[16px] text-white/80">
              No account needed. Sign up only when you want to save places and plans.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="press inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-medium text-black"
              >
                Open the map <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/plan"
                className="press inline-flex h-11 items-center rounded-full px-5 text-[15px] font-medium text-white ring-1 ring-white/40 hover:bg-white/10"
              >
                Plan a trip
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 px-5 py-8 text-[13px] text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <span className="flex items-center gap-2">
            <LogoMark className="size-6 rounded-md" /> City Cake, a college project
          </span>
          <span>Map data © OpenStreetMap contributors. Photos from Wikimedia Commons. Routes by OSRM.</span>
        </div>
      </footer>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
          <LogoMark />
          City Cake
        </Link>
        <nav className="flex items-center gap-1 text-[14px]">
          {[
            ["Explore", "/explore"],
            ["Nearby", "/nearby"],
            ["Plan", "/plan"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="hidden h-9 items-center rounded-full px-3 text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/explore"
            className="press ml-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 font-medium text-background"
          >
            Open the app
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeroCollage({ home, ellora, daulatabad }: { home?: TownCard; ellora?: TownCard; daulatabad?: TownCard }) {
  return (
    <div className="relative mx-auto grid w-full max-w-[560px] grid-cols-[1.25fr_1fr] gap-3 lg:max-w-none">
      <Photo town={home} className="row-span-2 aspect-[3/4]" sizes="(min-width: 1024px) 340px, 55vw" priority />
      <Photo town={ellora} className="aspect-[4/3.4]" sizes="(min-width: 1024px) 270px, 45vw" />
      <Photo town={daulatabad} className="aspect-[4/3.4]" sizes="(min-width: 1024px) 270px, 45vw" />

      {/* A map pin card, the way the app shows a selected place. */}
      <div className="absolute top-6 -left-3 flex items-center gap-2.5 rounded-2xl bg-surface/95 py-2 pr-4 pl-2 shadow-[0_8px_32px_rgb(0_0_0/0.14)] ring-1 ring-hairline backdrop-blur sm:-left-6">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--route)] text-white">
          <MapPin className="size-3.5" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-[14px] font-semibold">{home?.photo?.placeName ?? "Bibi Ka Maqbara"}</p>
          <p className="text-[12px] text-muted-foreground">Chhatrapati Sambhajinagar</p>
        </div>
      </div>

      {/* A route card. */}
      <div className="absolute -bottom-5 left-6 flex items-center gap-3 rounded-2xl bg-surface/95 px-3.5 py-2.5 shadow-[0_8px_32px_rgb(0_0_0/0.14)] ring-1 ring-hairline backdrop-blur sm:left-12">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--route)] text-white">
          <Car className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-[14px] font-semibold tabular-nums">To Ellora Caves</p>
          <p className="text-[12px] text-muted-foreground tabular-nums">29 km by road</p>
        </div>
      </div>

      {/* A chat bubble. */}
      <div className="absolute -right-2 bottom-[38%] max-w-[210px] rounded-[18px] rounded-br-md bg-[var(--route)] px-3.5 py-2 text-[13.5px] leading-snug text-white shadow-[0_8px_32px_rgb(0_0_0/0.14)] sm:-right-5">
        Is Ellora open on Tuesday?
      </div>
    </div>
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
    <div className={cn("relative overflow-hidden rounded-[24px] bg-surface-raised ring-1 ring-black/5 ring-inset", className)}>
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
        <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">
          {town.name}
        </span>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-[34px] leading-none font-semibold tracking-[-0.02em] tabular-nums md:text-[40px]">
        <NumberTicker value={value} startOnView locale="en-IN" />
      </dd>
      <dd className="mt-2 max-w-[22ch] text-[14px] text-muted-foreground">{label}</dd>
    </div>
  );
}

function TripCard({ town }: { town: TownCard }) {
  return (
    <Link href={`/explore?city=${town.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-surface-raised ring-1 ring-black/5 ring-inset">
        {town.photo ? (
          <Image
            src={town.photo.url}
            alt={`${town.photo.placeName}, ${town.name}`}
            fill
            sizes="280px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CategoryTile category="attraction" size="lg" />
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-surface/95 px-2.5 py-1 text-[12px] font-medium tabular-nums shadow-sm">
          {town.distanceKm} km
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{town.name}</h3>
        <span className="text-[13px] text-muted-foreground" lang="mr">
          {town.localName}
        </span>
      </div>
      <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{town.blurb}</p>
    </Link>
  );
}

function Feature({
  title,
  body,
  href,
  className,
  children,
}: {
  title: string;
  body: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[24px] bg-surface ring-1 ring-hairline transition-colors hover:ring-black/15",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-0">
        <div>
          <h3 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h3>
          <p className="mt-1.5 max-w-[44ch] text-[15px] leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <ArrowUpRight
          className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
      <div className="mt-6 flex flex-1 items-end px-6">{children}</div>
    </Link>
  );
}

const PLAN_SAMPLE = [
  { t: "09:00", name: "Soneri Mahal", cat: "heritage", d: "1 h 30" },
  { t: "10:35", name: "Aurangabad Caves", cat: "heritage", d: "1 h 30" },
  { t: "12:15", name: "Bhadkal Gate", cat: "heritage", d: "1 h 30" },
  { t: "13:50", name: "Great Sagar Restaurant", cat: "food", d: "1 h" },
];

function PlanMock() {
  return (
    <div className="w-full rounded-t-[18px] bg-background p-4 pb-2 ring-1 ring-hairline">
      <div className="mb-3 flex gap-1.5 text-[12px] font-medium">
        <span className="rounded-full bg-foreground px-3 py-1 text-background">Day 1</span>
        <span className="rounded-full px-3 py-1 text-muted-foreground ring-1 ring-hairline">Day 2 · Ellora</span>
      </div>
      <ol className="space-y-1.5">
        {PLAN_SAMPLE.map((s) => (
          <li key={s.name} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2 ring-1 ring-hairline">
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
  { name: "Bank of Maharashtra", cat: "atm", m: "600 m" },
];

function NearbyMock() {
  return (
    <div className="w-full divide-y divide-hairline rounded-t-[18px] bg-background ring-1 ring-hairline">
      {NEARBY_SAMPLE.map((n) => (
        <div key={n.name} className="flex items-center gap-3 px-3 py-2.5">
          <CategoryTile category={n.cat} size="sm" />
          <span className="min-w-0 flex-1 truncate text-[14px]">{n.name}</span>
          <span className="text-[12px] text-muted-foreground tabular-nums">{n.m}</span>
        </div>
      ))}
    </div>
  );
}

function ChatMock() {
  return (
    <div className="w-full space-y-2 rounded-t-[18px] bg-background p-4 ring-1 ring-hairline">
      <p className="ml-auto w-fit max-w-[80%] rounded-[18px] rounded-br-md bg-[var(--route)] px-3.5 py-2 text-[14px] text-white">
        Where can I eat near Bibi Ka Maqbara?
      </p>
      <p className="w-fit max-w-[88%] rounded-[18px] rounded-bl-md bg-surface px-3.5 py-2 text-[14px] leading-snug ring-1 ring-hairline">
        Great Sagar Restaurant, Alankar and Naaz tea stall are all within about 2 km.
      </p>
      <p className="flex items-center gap-1.5 pt-1 text-[12px] text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden /> Checked against the places in this guide
      </p>
    </div>
  );
}

function RouteMock({ ellora }: { ellora?: TownCard }) {
  return (
    <div className="relative h-[190px] w-full overflow-hidden rounded-t-[18px] bg-[oklch(0.95_0.02_120)] ring-1 ring-hairline dark:bg-[oklch(0.3_0.02_140)]">
      <svg viewBox="0 0 400 190" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M0 140 C80 120 120 160 200 130 S330 70 400 90" stroke="oklch(0.88 0.03 90)" strokeWidth="14" fill="none" />
        <path d="M40 30 C120 60 160 40 220 80 S330 150 390 170" stroke="oklch(0.9 0.02 90)" strokeWidth="9" fill="none" />
        <path
          d="M70 150 C120 110 150 120 190 100 S280 60 330 50"
          stroke="var(--route)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="70" cy="150" r="8" fill="white" stroke="var(--route)" strokeWidth="4" />
      </svg>
      <span className="absolute top-[22px] left-[78%] flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-[oklch(0.62_0.13_70)] text-white ring-[3px] ring-white">
        <Navigation className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="absolute right-3 bottom-3 left-3 flex items-center gap-3 rounded-2xl bg-surface/95 px-3 py-2 shadow-sm ring-1 ring-hairline">
        {ellora?.photo ? (
          <span className="relative size-9 shrink-0 overflow-hidden rounded-lg">
            <Image src={ellora.photo.url} alt="" fill sizes="36px" className="object-cover" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">City centre to Ellora Caves</p>
          <p className="text-[12px] text-muted-foreground tabular-nums">29 km · driving</p>
        </div>
      </div>
    </div>
  );
}
