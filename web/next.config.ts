import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@onehope/server"],
  outputFileTracingRoot: path.join(__dirname, ".."),
  poweredByHeader: false,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**.ytimg.com" }],
  },
};

export default nextConfig;
