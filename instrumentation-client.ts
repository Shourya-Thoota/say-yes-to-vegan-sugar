// Browser-side Sentry initialization (Next.js App Router convention).
// Loaded automatically by Next.js in the client bundle.

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, sentryBeforeBreadcrumb, sentryBeforeSend } from "./lib/sentry";

const dsn = getSentryDsn();

Sentry.init({
  dsn: dsn ?? undefined,
  // Disabled without a DSN, and disabled outside production builds, so local
  // development never emits events.
  enabled: dsn !== null && process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,

  // --- Deliberately NOT enabled ---
  // Session Replay, tracing (tracesSampleRate), profiling
  // (profileSessionSampleRate), user feedback, and console/log forwarding are
  // all left off. Error events only.

  // Restrict automatic data collection (SDK v11: dataCollection replaces the
  // removed sendDefaultPii flag). Everything not needed for debugging a
  // broken submission is off. beforeSend/beforeBreadcrumb add a second layer.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  },

  beforeSend: sentryBeforeSend,
  beforeBreadcrumb: sentryBeforeBreadcrumb,
});
