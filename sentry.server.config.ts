// Server-side Sentry initialization (Node.js runtime).
// Loaded from instrumentation.ts via register().

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, getSharedSentryOptions } from "./lib/sentry";

const dsn = getSentryDsn();

Sentry.init({
  dsn: dsn ?? undefined,
  // Disabled without a DSN, and outside production, so local development and
  // `next build` never emit events.
  enabled: dsn !== null && process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,

  // --- Deliberately NOT enabled ---
  // Tracing, profiling, and log forwarding are left off. Error events only.

  ...getSharedSentryOptions(),
});
