"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { api } from "@/convex/_generated/api";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type UserError = { error: string; minimumLength?: number; maximumLength?: number; retryAfterMs?: number };

/** Every error the username and password flows can return, in plain words. */
function message(e: UserError): { text: string; field: "username" | "password" | null } {
  switch (e.error) {
    case "INVALID_CREDENTIALS":
      return { text: "That username and password don't match.", field: "password" };
    case "USER_NOT_FOUND":
      return { text: "No account has that username. Check it, or create an account.", field: "username" };
    case "RATE_LIMITED": {
      const s = Math.ceil((e.retryAfterMs ?? 30000) / 1000);
      return { text: `Too many attempts. Try again in ${s} seconds.`, field: null };
    }
    case "PASSWORD_TOO_SHORT":
      return { text: `Use at least ${e.minimumLength} characters for the password.`, field: "password" };
    case "PASSWORD_TOO_LONG":
      return { text: `Use at most ${e.maximumLength} characters for the password.`, field: "password" };
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return { text: "Remove the spaces at the start or end of the password.", field: "password" };
    case "PASSWORD_TOO_COMMON":
      return { text: "That password is too common. Pick something harder to guess.", field: "password" };
    case "USERNAME_TOO_SHORT":
      return { text: `Use at least ${e.minimumLength} characters for the username.`, field: "username" };
    case "USERNAME_TOO_LONG":
      return { text: `Use at most ${e.maximumLength} characters for the username.`, field: "username" };
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
      return { text: "Remove the spaces at the start or end of the username.", field: "username" };
    case "USERNAME_HAS_INVALID_CHARACTERS":
      return { text: "Use only letters, numbers, dots, dashes and underscores.", field: "username" };
    case "USERNAME_TAKEN":
      return { text: "That username is taken. Try another, or sign in.", field: "username" };
    default:
      return { text: "Something went wrong on our side. Check your connection and try again.", field: null };
  }
}

/** Every sign-in lands on the planner: planning the trip is where the app starts. */
const AFTER_SIGN_IN = "/plan";

const COPY = {
  signin: {
    title: "Welcome back",
    lede: "Sign in to pick up your trip where you left it.",
    submit: "Sign in",
    pending: "Signing in",
  },
  signup: {
    title: "Plan your trip",
    lede: "Make an account to plan your days, save places and follow the drive live on the map.",
    submit: "Create account",
    pending: "Creating account",
  },
} as const;

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const signIn = useSignInWithUsernamePassword(api.auth);
  const signUp = useSignUpWithUsernamePassword(api.auth);
  const pending = mode === "signin" ? signIn.pending : signUp.pending;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ text: string; field: "username" | "password" | null } | null>(null);
  const copy = COPY[mode];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const credentials = { username: username.trim(), password };
    const result = mode === "signin" ? await signIn.signIn(credentials) : await signUp.signUp(credentials);
    if (result.status === "complete") {
      router.push(AFTER_SIGN_IN);
      router.refresh();
      return;
    }
    setError(message(result.userError as UserError));
  }

  const field =
    "h-12 w-full rounded-2xl bg-white px-4 text-[16px] text-[var(--lp-ink)] shadow-[0_1px_2px_rgb(60_40_10/0.06)] ring-1 ring-black/10 outline-none transition-shadow duration-150 placeholder:text-foreground/35 focus-visible:ring-2 focus-visible:ring-[var(--route)] disabled:opacity-60 aria-invalid:ring-2 aria-invalid:ring-destructive/60";

  const tabs = [
    { key: "signup", label: "Create account", href: "/signup" },
    { key: "signin", label: "Sign in", href: "/signin" },
  ] as const;

  return (
    <div>
      <nav aria-label="Account" className="lp-rise inline-flex rounded-full bg-white/70 p-1 ring-1 ring-black/5 backdrop-blur">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            replace
            aria-current={mode === t.key ? "page" : undefined}
            className={cn(
              "relative isolate inline-flex h-9 items-center rounded-full px-4 text-[14px] font-medium transition-colors duration-150",
              mode === t.key ? "text-white" : "text-foreground/60 hover:text-foreground",
            )}
          >
            {mode === t.key && (
              <motion.span
                layoutId="auth-tab"
                transition={SPRING_LAYOUT}
                className="absolute inset-0 -z-10 rounded-full bg-[var(--lp-ink)]"
              />
            )}
            {t.label}
          </Link>
        ))}
      </nav>

      <h1
        className="lp-rise mt-7 text-[36px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance sm:text-[44px]"
        style={delay(60)}
      >
        {copy.title}
      </h1>
      <p className="lp-rise mt-3 max-w-[38ch] text-[16px] leading-relaxed text-foreground/65" style={delay(120)}>
        {copy.lede}
      </p>

      <form onSubmit={onSubmit} className="lp-rise mt-8 space-y-4" style={delay(180)} noValidate>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-foreground/75">Username</span>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder={mode === "signup" ? "Pick a username" : "Your username"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
            aria-invalid={error?.field === "username" || undefined}
            aria-describedby={mode === "signup" ? "username-hint" : undefined}
            className={field}
          />
          {mode === "signup" && (
            <span id="username-hint" className="mt-1.5 block text-[12.5px] text-foreground/50">
              Letters, numbers, dots, dashes and underscores.
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-foreground/75">Password</span>
          <span className="relative block">
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              placeholder={mode === "signup" ? "Make it hard to guess" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              aria-invalid={error?.field === "password" || undefined}
              className={cn(field, "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              className="press absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-foreground/50 hover:bg-black/5 hover:text-foreground"
            >
              {show ? (
                <EyeOff className="size-[18px]" strokeWidth={1.75} aria-hidden />
              ) : (
                <Eye className="size-[18px]" strokeWidth={1.75} aria-hidden />
              )}
            </button>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
            {error.text}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !username.trim() || !password}
          className="press group mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lp-ink)] text-[15px] font-medium text-white transition-opacity duration-150 disabled:opacity-45"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {copy.pending}
            </>
          ) : (
            <>
              {copy.submit}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[14px] text-foreground/60">
        {mode === "signin" ? "New here? " : "Have an account? "}
        <Link
          href={mode === "signin" ? "/signup" : "/signin"}
          replace
          className="font-medium text-[var(--route)] hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
