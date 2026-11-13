import type { NextConfig } from "next";

/**
 * Admin panel on its own subdomain when ADMIN_HOST is set at build time (e.g. admin.vedicvisa.com):
 *   admin.vedicvisa.com/          → /admin
 *   admin.vedicvisa.com/orders    → /admin/orders   (/admin/... paths also work as-is)
 *   vedicvisa.com/admin/...       → redirected to the admin subdomain
 * Done with config rewrites (no proxy/middleware) so it runs fine on Cloudflare Workers.
 */
const adminHost = process.env.ADMIN_HOST;
const SKIP = "admin|api|login|_next|brand|uploads|favicon\\.ico";

const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
  "font-src 'self' data: https://cdn.fontshare.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://*.r2.cloudflarestorage.com${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://api.razorpay.com\")" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // `npm run build:check` builds into .next-check so it never clobbers a running `next dev` (that caused an endless reload loop).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    if (!adminHost) return [];
    const has = [{ type: "host" as const, value: adminHost }];
    return {
      beforeFiles: [
        { source: "/", has, destination: "/admin" },
        { source: `/:path((?!${SKIP}).*)`, has, destination: "/admin/:path" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    if (!adminHost) return [];
    return [
      { source: "/admin", missing: [{ type: "host", value: adminHost }], destination: `https://${adminHost}/`, permanent: true },
      { source: "/admin/:path*", missing: [{ type: "host", value: adminHost }], destination: `https://${adminHost}/:path*`, permanent: true },
    ];
  },
};

export default nextConfig;
