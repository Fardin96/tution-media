import type { NextConfig } from "next";

type RemotePatterns = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>;

// Only the API's public R2 prefix may be optimized, and only that exact host and path.
// A missing or malformed value yields no patterns rather than a wildcard.
function mediaRemotePatterns(): RemotePatterns {
  const raw = process.env.NEXT_PUBLIC_MEDIA_URL_PREFIX;
  if (!raw) return [];

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [];
  }
  if (url.protocol !== "https:") return [];

  return [
    {
      protocol: "https",
      hostname: url.hostname,
      port: url.port,
      pathname: `${url.pathname.replace(/\/+$/, "")}/**`,
      search: "",
    },
  ];
}

const nextConfig: NextConfig = {
  // Lets phones on the local network load dev assets via the LAN IP
  // (e.g. http://192.168.0.147:3000). Dev-only; ignored in production.
  allowedDevOrigins: ["192.168.*.*"],

  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    // Only the default quality is used; a new quality= value must be added here or it is coerced.
    qualities: [75],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    // The floor for optimized copies; Next keeps the larger of this and the source's max-age
    // (7 days for the public media bucket). A day, because optimized images can't be purged
    // and /assets files may be replaced in place.
    minimumCacheTTL: 86400,
    remotePatterns: mediaRemotePatterns(),
    // dangerouslyAllowSVG stays off: SVG can carry script.
  },

  experimental: {
    optimizePackageImports: [
      "@hugeicons/core-free-icons",
      "@hugeicons/react",
      "radix-ui",
      "motion",
    ],
  },

  async headers() {
    return [
      {
        // Not immutable: these file names aren't hashed and site content points at them,
        // so a replaced file has to reach browsers within a day.
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
