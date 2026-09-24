import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio", "robots-parser", "scrapegraph-js"],
};

export default nextConfig;
