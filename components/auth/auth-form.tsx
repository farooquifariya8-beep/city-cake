"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { api } from "@/convex/_generated/api";
import { LogoMark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/format";

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

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const signIn = useSignInWithUsernamePassword(api.auth);
  const signUp = useSignUpWithUsernamePassword(api.auth);
  const pending = mode === "signin" ? signIn.pending : signUp.pending;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ text: string; field: "username" | "password" | null } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const credentials = { username, password };
    const result =
      mode === "signin" ? await signIn.signIn(credentials) : await signUp.signUp(credentials);
    if (result.status === "complete") {
      router.push(next);
      router.refresh();
      return;
    }
    setError(message(result.userError as UserError));
  }

  const other = mode === "signin" ? "/signup" : "/signin";
  const field =
    "mt-1.5 h-11 w-full rounded-xl bg-black/[0.055] px-3.5 text-[15px] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:ring-2 aria-invalid:ring-destructive/50 dark:bg-white/10";

  return (
    <div className="mx-auto w-full max-w-sm pt-6 md:pt-14">
      <LogoMark className="size-11 rounded-2xl" />
      <h1 className="large-title mt-5">{mode === "signin" ? "Sign in" : "Create an account"}</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        {mode === "signin"
          ? "Your saved places and trips are waiting."
          : "Save places and trip plans. Browsing works without one."}
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <label className="block">
          <span className="text-[13px] font-medium">Username</span>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
            aria-invalid={error?.field === "username" || undefined}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Password</span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            aria-invalid={error?.field === "password" || undefined}
            className={field}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[14px] text-destructive">
            {error.text}
          </p>
        )}
        <Button type="submit" disabled={pending || !username || !password} className="h-11 w-full rounded-xl text-[15px]">
          {pending ? (mode === "signin" ? "Signing in" : "Creating account") : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-muted-foreground">
        {mode === "signin" ? "New here? " : "Have an account? "}
        <Link href={`${other}?next=${encodeURIComponent(next)}`} className="font-medium text-link">
          {mode === "signin" ? "Create an account" : "Sign in"}
        </Link>
      </p>
      <p className="mt-2 text-center text-[13px]">
        <Link href={next} className="text-muted-foreground hover:text-foreground">
          Keep browsing without an account
        </Link>
      </p>
    </div>
  );
}
