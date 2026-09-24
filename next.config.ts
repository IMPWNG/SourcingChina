import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: ["cheerio", "robots-parser", "scrapegraph-js", "tesseract.js"],
  outputFileTracingIncludes: {
    "/admin/upload": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/node-fetch/**/*",
      "./node_modules/@tesseract.js-data/eng/4.0.0/**/*",
      "./node_modules/@tesseract.js-data/chi_sim/4.0.0/**/*",
    ],
  },
};

export default nextConfig;
