"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";

/**
 * The app's theme provider, with one exception: the landing page is always
 * light. The landing's photos, mesh backdrop and type are tuned for cream.
 * Navigating away hands control back to the stored or system theme.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      forcedTheme={pathname === "/" ? "light" : undefined}
    >
      {children}
    </ThemeProvider>
  );
}
