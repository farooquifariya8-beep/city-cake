import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  devIndicators: false,
  experimental: {
    // The dev-only instant-navigation check fails to load the Convex Auth
    // client module in its prefetch pass. Validate only segments that opt in.
    instantInsights: { validationLevel: "manual-warning" },
  },
  images: {
    // Wikipedia thumbnails. lib/format.ts strips their query strings.
    remotePatterns: [
      { protocol: "https", hostname: "thumb.wikimedia.org", pathname: "/wikipedia/**", search: "" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/wikipedia/**", search: "" },
    ],
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
