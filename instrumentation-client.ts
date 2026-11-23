// Browser-side Sentry initialization (Next.js App Router convention).

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, getSharedSentryOptions } from "./lib/sentry";

const dsn = getSentryDsn();

Sentry.init({
  dsn: dsn ?? undefined,
  // Disabled without a DSN, and outside production builds, so local
  // development never emits events.
  enabled: dsn !== null && process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,

  // --- Deliberately NOT enabled ---
  // Tracing, Session Replay, profiling, user feedback, and console/log
  // forwarding are all left off. Error events only; breadcrumbs are disabled
  // inside the shared options (maxBreadcrumbs: 0).

  ...getSharedSentryOptions(),
});
