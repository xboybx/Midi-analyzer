import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Electron production builds — generates a fully static site in /out
  output: "export",

  // Required when loading from file:// in Electron (no trailing slash redirects)
  trailingSlash: true,

  // Disable the built-in image optimizer (not available in static export)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
