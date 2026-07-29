/**
 * next.config.ts
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode: catches React lifecycle issues in development
  reactStrictMode: true,

  // Typed Next.js routes — catches broken hrefs at compile time
  typedRoutes: true,

  // Silence the Prisma require('module') warning in serverless builds
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;