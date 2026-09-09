import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/submarine-zero",
  reactStrictMode: true,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
