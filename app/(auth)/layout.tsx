import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Navigation } from "lucide-react";
import { LogoMark } from "@/components/shell/logo";
import { getLandingData } from "@/components/landing/data";
import { photoUrl } from "@/lib/format";

const STEPS = ["Make an account", "Plan your days", "Follow the road"] as const;

/**
 * Sign in and sign up: no app chrome. The form on the landing's cream, and a
 * real photo from the guide beside it (above it on phones).
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { towns } = await getLandingData();
  const town = towns.find((t) => t.slug === "ellora" && t.photo) ?? towns.find((t) => t.photo);
  const photo = town?.photo;

  return (
    <div className="landing relative isolate flex min-h-dvh flex-col overflow-x-clip text-[var(--lp-ink)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
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

      {/* Form column */}
      <div className="flex min-h-dvh flex-col px-5 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),20px)] md:px-10">
        <header className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
            <LogoMark />
            City Cake
          </Link>
          <Link
            href="/"
            className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-white/70 pr-3.5 pl-2.5 text-[13px] font-medium text-foreground/70 ring-1 ring-black/5 backdrop-blur hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
            Home
          </Link>
        </header>

        {/* Phones: the photo above the form. */}
        {photo && (
          <div className="lp-rise relative mt-3 aspect-[16/9] overflow-hidden rounded-[24px] ring-1 ring-black/5 ring-inset sm:aspect-[2/1] lg:hidden">
            <Image src={photoUrl(photo.url, 960)} alt={photo.placeName} fill sizes="(min-width: 1024px) 1px, 100vw" priority className="object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgb(20_12_4/0.7))]" />
            <p className="absolute bottom-3.5 left-4 text-[13px] font-medium text-white/90">{photo.placeName}</p>
          </div>
        )}

        <main className="flex flex-1 items-center py-8 lg:py-12">
          <div className="mx-auto w-full max-w-[400px]">{children}</div>
        </main>

        <p className="text-center text-[12px] text-foreground/50 lg:text-left">
          A city guide for Chhatrapati Sambhajinagar and its day trips. Map data © OpenStreetMap contributors.
        </p>
      </div>

      {/* Desktop: the photo, with what happens after sign-in. */}
      <aside className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="lp-settle relative isolate h-full overflow-hidden rounded-[28px] bg-[var(--lp-ink)] text-white">
          {photo && (
            <Image src={photoUrl(photo.url, 960)} alt={photo.placeName} fill sizes="55vw" priority className="-z-10 object-cover" />
          )}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(20_12_4/0.1)_30%,rgb(20_12_4/0.82))]" />

          <div className="absolute top-6 right-6 w-[280px] rounded-[20px] bg-white/95 p-3.5 text-[var(--lp-ink)] shadow-[0_8px_32px_rgb(0_0_0/0.18)]">
            <div className="flex items-center gap-3 rounded-[12px] bg-[var(--lp-ink)] px-3 py-2.5 text-white">
              <Navigation className="size-6 rotate-[-45deg]" strokeWidth={2} aria-hidden />
              <div className="leading-tight">
                <p className="text-[18px] font-semibold tabular-nums">300 m</p>
                <p className="text-[12.5px] text-white/75">Turn left onto Ellora Road</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["11:40", "arrival"],
                ["38", "min"],
                ["24", "km"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="text-[17px] font-semibold tabular-nums">{v}</p>
                  <p className="text-[11.5px] text-foreground/55">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-10">
            <h2 className="max-w-[16ch] text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance">
              Plan the days, then follow the road
            </h2>
            <ol className="mt-6 flex flex-wrap gap-2">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-white/15 pr-3.5 pl-1.5 text-[14px] ring-1 ring-white/25 backdrop-blur"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-black tabular-nums">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            {photo && <p className="mt-6 text-[12.5px] text-white/60">{photo.placeName}. Photo from Wikimedia Commons.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
