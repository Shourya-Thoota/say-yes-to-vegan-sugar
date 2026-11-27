import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // pg resolves pg-cloudflare through a "workerd" export condition, which
  // Next's Node-based file tracer does not see: it traces only dist/empty.js.
  // The Workers bundle still requires dist/index.js at build time, so include
  // the whole package explicitly. Harmless for the Railway (Node) image.
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/pg-cloudflare/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "512kb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' accounts.google.com https://*.ingest.sentry.io https://*.ingest.de; frame-src accounts.google.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      {
        source: "/api/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

// Sentry build wrapper. Source-map upload is disabled ("disable-upload":
// debug IDs are still injected but nothing leaves the build), so builds never
// require SENTRY_AUTH_TOKEN and never fail when upload credentials are absent.
// To enable uploads later, set org/project and remove the disable flag (see README).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: "disable-upload",
  },
  // Source maps are not publicly served (Next.js serves .map files only when
  // productionBrowserSourceMaps is true, which remains unset/false).
  widenClientFileUpload: false,
});
