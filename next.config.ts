import type { NextConfig } from "next";

// The project sits on an SMB share that can't fsync, so Turbopack's persistent
// cache can't be written there. Vercel builds on a normal disk and keeps it.
const onVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    turbopackFileSystemCacheForBuild: onVercel,
    turbopackFileSystemCacheForDev: onVercel,
  },
};

export default nextConfig;
