import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A warm Turbopack cache on Vercel has shipped a stale Tailwind stylesheet
    // before; a cold build costs a few seconds and avoids it.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
