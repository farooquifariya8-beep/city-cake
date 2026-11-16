import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/shell/logo";
import { CategoryTile } from "@/components/category/category-chip";
import { NumberTicker } from "@/components/motion/number-ticker";
import { HeroSearch } from "@/components/landing/hero-search";
import { HeroCollage } from "@/components/landing/hero-collage";
import { TripsRail } from "@/components/landing/trips-rail";
import { Features, type FeatureItem } from "@/components/landing/features";
import { PlanFigure } from "@/components/landing/plan-figure";
import { DistanceChart } from "@/components/landing/distance-chart";
import { NavLinks } from "@/components/landing/nav-links";
import { Reveal, SmoothScroll } from "@/components/landing/motion";
import { ChatMock, NearbyMock, PlanMock, RouteMock, SearchMock } from "@/components/landing/mocks";
import { getLandingData } from "@/components/landing/data";
import { CATEGORY_KEYS } from "@/convex/lib/categories";

export const metadata: Metadata = {
  title: "City Cake: a guide to Chhatrapati Sambhajinagar, Ellora and Ajanta",
};

const QUICK = [
  { label: "Heritage", href: "/explore?cat=heritage", cat: "heritage" },
  { label: "Food", href: "/explore?cat=food", cat: "food" },
  { label: "Hospitals", href: "/nearby?cat=hospital", cat: "hospital" },
  { label: "ATMs", href: "/nearby?cat=atm", cat: "atm" },
];

const STEPS = [
  ["All the places in town", "Every place in the guide is ranked. The planner starts at the top of the list."],
  ["A few, nearest first", "Relaxed, balanced or packed picks 3, 4 or 6 stops. Each next stop is the closest one left."],
  [
    "Timed into a day",
    "Time at each stop, the drive between them, lunch after 12:30, and a warning if a site is shut that weekday.",
  ],
] as const;

/** Every way into the app starts with an account, then the planner. */
const START = "/signup";
const SIGN_IN = "/signin";

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const rise = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

const kicker = "text-[13px] font-medium tracking-[0.08em] text-[oklch(0.5_0.1_70)] uppercase";
const sectionTitle = "mt-2 text-[32px] leading-[1.05] font-semibold tracking-[-0.025em] text-balance md:text-[44px]";

export default async function Home() {
  const { towns, places, facilities } = await getLandingData();
  const home = towns.find((t) => t.kind === "home") ?? towns[0];
  const ellora = towns.find((t) => t.slug === "ellora");
  const daulatabad = towns.find((t) => t.slug === "daulatabad");
  const trips = towns.filter((t) => t.kind === "daytrip").sort((a, b) => a.distanceKm - b.distanceKm);

  const features: FeatureItem[] = [
    {
      key: "search",
      tint: "oklch(0.93 0.035 262)",
      kicker: "Search",
      title: "Look up any place in India",
      body: "Places in this guide come first. Anything else, from a wada in Pune to a ghat in Varanasi, comes from OpenStreetMap and opens on the same map.",
      href: "/explore",
      cta: "Search the map",
      preview: <SearchMock />,
    },
    {
      key: "plan",
      tint: "oklch(0.93 0.05 75)",
      kicker: "Planner",
      title: "A plan for each day",
      body: "Pick how many days and how busy. You get a timed day per town with lunch in the middle, and you can move, swap or add stops.",
      href: "/plan",
      cta: "Plan a trip",
      preview: <PlanMock />,
    },
    {
      key: "nearby",
      tint: "oklch(0.93 0.04 160)",
      kicker: "Nearby",
      title: "The closest pharmacy, ATM or bus stand",
      body: "Share your location, or pick a town. Hospitals, pharmacies, ATMs, fuel and toilets, sorted by how far they are.",
      href: "/nearby",
      cta: "See what is near",
      preview: <NearbyMock />,
    },
    {
      key: "assistant",
      tint: "oklch(0.93 0.035 350)",
      kicker: "Assistant",
      title: "Ask before you set out",
      body: "The assistant runs on an open model through Groq. It checks places, opening days and road times in this guide before it answers, and can turn a chat into a plan.",
      href: "/assistant",
      cta: "Ask a question",
      preview: <ChatMock />,
    },
    {
      key: "routes",
      tint: "oklch(0.93 0.035 205)",
      kicker: "Routes",
      title: "Routes over the terrain",
      body: "Pick your stops, switch between driving and walking, and follow the road over a 3D map of the Deccan hills.",
      href: "/map",
      cta: "Open the 3D map",
      preview: <RouteMock ellora={ellora} />,
    },
  ];

  return (
    <div className="landing flex min-h-full flex-col overflow-x-clip text-[var(--lp-ink)]">
      <SmoothScroll />
      <Nav />

      {/* Hero */}
      <section className="relative isolate -mt-16 pt-16">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="lp-mesh">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="lp-grain" />
        </div>

        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-14 px-5 pt-10 pb-20 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 lg:pt-20 lg:pb-28">
          <div className="min-w-0">
            <p
              className="lp-rise inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[13px] text-foreground/70 ring-1 ring-black/5 backdrop-blur"
              style={rise(0)}
            >
              <span className="size-1.5 rounded-full bg-[oklch(0.68_0.13_70)]" aria-hidden />
              City guide for Maharashtra&apos;s Deccan
            </p>
            <h1
              className="lp-rise mt-6 text-[42px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[60px] lg:text-[68px]"
              style={rise(90)}
            >
              Find your way around Chhatrapati Sambhajinagar
            </h1>
            <p className="lp-rise mt-3 text-[18px] text-foreground/45 sm:text-[20px]" lang="mr" style={rise(160)}>
              {home?.localName ?? "छत्रपती संभाजीनगर"}
            </p>
            <p
              className="lp-rise mt-5 max-w-[46ch] text-[17px] leading-relaxed text-pretty text-foreground/70"
              style={rise(220)}
            >
              Places to see, the nearest pharmacy, routes on a map and a plan for each day. For the city and its day
              trips to Ellora, Daulatabad and Ajanta.
            </p>
            <div className="lp-rise mt-8 flex flex-wrap items-center gap-3" style={rise(300)}>
              <Link
                href={START}
                className="press group inline-flex h-12 items-center gap-2 rounded-full bg-[var(--lp-ink)] px-6 text-[15px] font-medium text-white"
              >
                Plan my trip
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link
                href={SIGN_IN}
                className="press inline-flex h-12 items-center rounded-full bg-white/70 px-5 text-[15px] font-medium ring-1 ring-black/10 backdrop-blur hover:bg-white"
              >
                I have an account
              </Link>
            </div>
            <div className="lp-rise mt-6" style={rise(380)}>
              <HeroSearch />
            </div>
            <div className="lp-rise mt-4 flex flex-wrap gap-2" style={rise(440)}>
              {QUICK.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="press inline-flex h-9 items-center gap-2 rounded-full bg-white/80 pr-3.5 pl-1.5 text-[14px] ring-1 ring-black/5 backdrop-blur hover:bg-white"
                >
                  <CategoryTile category={q.cat} size="sm" className="size-6 rounded-full" />
                  {q.label}
                </Link>
              ))}
            </div>
          </div>

          <HeroCollage home={home} ellora={ellora} daulatabad={daulatabad} />
        </div>
      </section>

      {/* Numbers and distances */}
      <section className="mx-auto w-full max-w-[1240px] px-5 pt-8 md:px-8 md:pt-16">
        <div className="grid gap-10 rounded-[28px] bg-white/70 p-6 ring-1 ring-black/5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-14 md:p-10">
          <div>
            <Reveal>
              <h2 className="max-w-[18ch] text-[28px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance md:text-[36px]">
                One city, {COUNT_WORDS[trips.length] ?? trips.length} day trips, every pharmacy on the way
              </h2>
            </Reveal>
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-7">
              <Stat value={places} label="places to see" delay={0.05} />
              <Stat value={facilities} label="hospitals, ATMs, pharmacies and more" delay={0.12} />
              <Stat value={towns.length} label="towns covered" delay={0.19} />
              <Stat value={CATEGORY_KEYS.length} label="kinds of places and facilities" delay={0.26} />
            </dl>
          </div>
          <Reveal delay={0.1} className="self-center">
            <DistanceChart trips={trips} />
          </Reveal>
        </div>
      </section>

      <TripsRail trips={trips} />

      {/* Features */}
      <section aria-labelledby="features-title" className="pt-24 md:pt-28">
        <div className="mx-auto w-full max-w-[1240px] px-5 md:px-8">
          <Reveal>
            <p className={kicker}>What it does</p>
            <h2 id="features-title" className={`${sectionTitle} max-w-[20ch]`}>
              Everything for the trip, on one map
            </h2>
          </Reveal>
        </div>
        <div className="mt-6 md:mt-0">
          <Features items={features} />
        </div>
      </section>

      {/* How a day gets planned */}
      <section aria-labelledby="how-title" className="mx-auto w-full max-w-[1240px] px-5 pt-16 md:px-8 md:pt-24">
        <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
          <div>
            <Reveal>
              <p className={kicker}>How a day gets planned</p>
              <h2 id="how-title" className={`${sectionTitle} max-w-[18ch]`}>
                Simple rules you can check
              </h2>
            </Reveal>
            <ol className="mt-8 space-y-6">
              {STEPS.map(([title, body], i) => (
                <Reveal key={title} as="li" delay={0.08 * i} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-semibold tabular-nums ring-1 ring-black/10">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
                    <p className="mt-1 max-w-[46ch] text-[15px] leading-relaxed text-pretty text-foreground/65">{body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
          <PlanFigure />
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto w-full max-w-[1240px] px-5 py-24 md:px-8 md:py-32">
        <Reveal y={40}>
          <div className="relative isolate overflow-hidden rounded-[32px] bg-[oklch(0.25_0.02_60)] text-white">
            {ellora?.photo && (
              <Image
                src={ellora.photo.url}
                alt=""
                fill
                sizes="640px"
                className="-z-10 object-cover opacity-60"
              />
            )}
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(20_12_4/0.78),rgb(20_12_4/0.2))]" />
            <div className="max-w-[580px] px-7 py-16 md:px-14 md:py-24">
              <h2 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance md:text-[48px]">
                Plan the days, then follow the road
              </h2>
              <p className="mt-4 text-[16.5px] text-white/80">
                Make a free account, pick your stops, and drive with live directions, speed and arrival time on the map.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href={START}
                  className="press group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-black"
                >
                  Plan my trip
                  <ArrowRight
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <Link
                  href={SIGN_IN}
                  className="press inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium text-white ring-1 ring-white/40 hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 bg-[color-mix(in_oklch,var(--lp-cream)_72%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
          <LogoMark />
          City Cake
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <NavLinks />
          <Link
            href={SIGN_IN}
            className="press inline-flex h-9 items-center rounded-full px-3.5 text-[14px] text-foreground/70 hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href={START}
            className="press ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--lp-ink)] px-4 text-[14px] font-medium text-white"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Stat({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <Reveal delay={delay}>
      <dt className="sr-only">{label}</dt>
      <dd className="text-[36px] leading-none font-semibold tracking-[-0.03em] tabular-nums md:text-[44px]">
        <NumberTicker value={value} startOnView locale="en-IN" />
      </dd>
      <dd className="mt-2 max-w-[22ch] text-[14px] leading-snug text-foreground/60">{label}</dd>
    </Reveal>
  );
}

const FOOTER_LINKS = [
  ["Explore", "/explore"],
  ["Nearby", "/nearby"],
  ["Plan a trip", "/plan"],
  ["Assistant", "/assistant"],
  ["3D map", "/map"],
  ["Saved", "/saved"],
] as const;

function Footer() {
  return (
    <footer className="border-t border-black/[0.06]">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-5 py-12 text-[14px] md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <span className="flex items-center gap-2 text-[16px] font-semibold">
            <LogoMark className="size-7 rounded-lg" /> City Cake
          </span>
          <p className="mt-3 max-w-[36ch] text-foreground/60">
            A city guide for Chhatrapati Sambhajinagar and its day trips. A college project.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 content-start gap-2 text-foreground/70">
          {FOOTER_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="w-fit transition-colors hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-[13px] leading-relaxed text-foreground/55">
          Map data © OpenStreetMap contributors. Photos from Wikimedia Commons. Routes by OSRM.
        </p>
      </div>
    </footer>
  );
}
