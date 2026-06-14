import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // @ts-ignore
    after: true,
  },
};

export default nextConfig;
