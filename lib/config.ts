// Typed server-side configuration. Validates at runtime, never at import time
// during `next build`, so public pages can build without secrets.

export type ServerConfig = {
  databaseUrl: string | null;
  authSecret: string | null;
  googleId: string | null;
  googleSecret: string | null;
  adminEmails: string[];
  siteUrl: string;
  trustHost: boolean;
  isProduction: boolean;
  // Optional Sentry error monitoring flag. The DSN itself lives only in
  // NEXT_PUBLIC_SENTRY_DSN (read by lib/sentry.ts on both runtimes).
  sentryTestEnabled: boolean;
  // Optional Stripe sponsorship (Part 3B). All optional: the site works
  // cleanly with zero keys configured (see isStripeSponsorshipEnabled).
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  enableStripeSponsorship: boolean;
};

let cached: ServerConfig | null = null;

export function getServerConfig(): ServerConfig {
  if (cached) return cached;
  const adminRaw = process.env.ADMIN_EMAILS ?? "";
  cached = {
    databaseUrl: process.env.DATABASE_URL ?? null,
    authSecret: process.env.AUTH_SECRET ?? null,
    googleId: process.env.AUTH_GOOGLE_ID ?? null,
    googleSecret: process.env.AUTH_GOOGLE_SECRET ?? null,
    stripeSecretKey: (process.env.STRIPE_SECRET_KEY ?? "").trim() || null,
    stripeWebhookSecret: (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim() || null,
    enableStripeSponsorship: process.env.ENABLE_STRIPE_SPONSORSHIP === "true",
    adminEmails: adminRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    siteUrl: (
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    ).replace(/\/$/, ""),
    trustHost: (process.env.AUTH_TRUST_HOST ?? "true") !== "false",
    isProduction: process.env.NODE_ENV === "production",
    // Explicitly-enabled admin-only synthetic test event. Default off.
    sentryTestEnabled: process.env.SENTRY_TEST_ENABLED === "true",
  };
  return cached;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getServerConfig().adminEmails.includes(email.toLowerCase());
}

export function getPublicConfig() {
  const c = getServerConfig();
  return { siteUrl: c.siteUrl };
}

/**
 * Part 3B zero-key gate. Returns true ONLY when the operator explicitly
 * enabled live checkout AND a secret key is present. Never throws.
 */
export function isStripeSponsorshipEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENABLE_STRIPE_SPONSORSHIP === "true" && Boolean((env.STRIPE_SECRET_KEY ?? "").trim());
}

/** Base URL for Stripe success/cancel redirects. No trailing slash. */
export function getSiteBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return ((env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim() || "http://localhost:3000").replace(/\/$/, "");
}
