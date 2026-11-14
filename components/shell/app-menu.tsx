"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTheme } from "next-themes";
import {
  CalendarRange,
  Heart,
  LogIn,
  LogOut,
  MessageCircle,
  Moon,
  Sun,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** The account button: pages without a home in the nav, theme, and sign in or out. */
export function AppMenu({ className }: { className?: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const username = me?.username ?? null;
  const next = encodeURIComponent(pathname);

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/explore");
      router.refresh();
      toast("Signed out");
    } catch {
      toast.error("Could not sign out. Try again.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={username ? `Account menu for ${username}` : "Menu and sign in"}
        className={cn(
          "press inline-flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          isAuthenticated && username
            ? "bg-primary text-[13px] font-semibold text-primary-foreground"
            : "bg-black/[0.055] text-foreground hover:bg-black/10 dark:bg-white/10",
          className,
        )}
      >
        {isAuthenticated && username ? (
          username.slice(0, 1).toUpperCase()
        ) : (
          <UserRound className="size-[18px]" strokeWidth={1.75} aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-2xl p-1.5">
        {isAuthenticated && (
          <>
            <DropdownMenuLabel className="text-muted-foreground">
              Signed in as <span className="text-foreground">{username ?? "..."}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/plan">
            <CalendarRange strokeWidth={1.75} aria-hidden />
            Plan a trip
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/assistant">
            <MessageCircle strokeWidth={1.75} aria-hidden />
            Assistant
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/saved">
            <Heart strokeWidth={1.75} aria-hidden />
            Saved places and trips
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
        >
          {resolvedTheme === "dark" ? (
            <Sun strokeWidth={1.75} aria-hidden />
          ) : (
            <Moon strokeWidth={1.75} aria-hidden />
          )}
          {resolvedTheme === "dark" ? "Light appearance" : "Dark appearance"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isLoading ? (
          <DropdownMenuItem disabled>Checking your account</DropdownMenuItem>
        ) : isAuthenticated ? (
          <DropdownMenuItem onSelect={handleSignOut}>
            <LogOut strokeWidth={1.75} aria-hidden />
            Sign out
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/signin?next=${next}`}>
                <LogIn strokeWidth={1.75} aria-hidden />
                Sign in
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/signup?next=${next}`}>
                <UserPlus strokeWidth={1.75} aria-hidden />
                Create an account
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
