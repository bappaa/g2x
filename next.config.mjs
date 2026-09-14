/** @type {import('next').NextConfig} */
const nextConfig = {
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{ kebabCase member }}",
      preventFullImport: true,
    },
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
    staleTimes: { dynamic: 30, static: 180 },
    serverActions: { bodySizeLimit: "12mb" },
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [
      {
        source: "/api/media/:id",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/art/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
