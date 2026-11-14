"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = q.trim();
        router.push(text ? `/explore?q=${encodeURIComponent(text)}` : "/explore");
      }}
      className="flex h-14 w-full max-w-[520px] items-center gap-2 rounded-full bg-white pr-2 pl-5 shadow-[0_12px_40px_-8px_rgb(60_40_10/0.22)] ring-1 ring-black/5 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-[var(--route)]"
    >
      <Search className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <label htmlFor="hero-q" className="sr-only">
        Search a place
      </label>
      <input
        id="hero-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a place, like Bibi Ka Maqbara"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        autoComplete="off"
      />
      <button
        type="submit"
        className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--route)] px-4 text-[14px] font-medium text-white"
      >
        Search
        <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </form>
  );
}
