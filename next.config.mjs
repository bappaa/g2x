/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ship smaller JS: only the icons actually used are bundled, and heavy
  // libraries are tree-shaken per-import instead of pulled in wholesale.
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{ kebabCase member }}",
      preventFullImport: true,
    },
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
    // Client-side router cache. Without this Next 14 gives dynamic routes a 0s
    // stale time, so every single navigation refetches from the server and the
    // user stares at a spinner. 30s for prefetched shells / 3min for visited
    // pages makes back/forward and re-visits feel instant.
    staleTimes: { dynamic: 30, static: 180 },
  },
  compiler: {
    // Strip console.* in production, keep errors/warnings.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        // Uploaded media is content-addressed by row id — cache it hard.
        source: "/api/media/:id",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/art/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
