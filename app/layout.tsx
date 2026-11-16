import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@/lib/convexAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { categoryStylesheet } from "@/lib/category-style";
import { AppThemeProvider } from "@/components/landing/theme-provider";
import "./globals.css";

const CATEGORY_CSS = categoryStylesheet();

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "City: Chhatrapati Sambhajinagar city guide",
    template: "%s · City",
  },
  description:
    "Find places, facilities and routes around Chhatrapati Sambhajinagar, Ellora and Ajanta, and plan a trip day by day.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#16171a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: CATEGORY_CSS }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* The theme provider reads the pathname to keep "/" light, so it sits inside Suspense. */}
        <Suspense>
          <AppThemeProvider>
            <ConvexAuthNextjsServerProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </ConvexAuthNextjsServerProvider>
            <Toaster position="top-center" />
          </AppThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
