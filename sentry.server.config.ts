// Server-side Sentry initialization (Node.js runtime).
// Loaded from instrumentation.ts via register().

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, sentryBeforeBreadcrumb, sentryBeforeSend } from "./lib/sentry";

const dsn = getSentryDsn();

Sentry.init({
  dsn: dsn ?? undefined,
  // Disabled without a DSN, and disabled outside production, so local
  // development and `next build` never emit events.
  enabled: dsn !== null && process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,

  // --- Deliberately NOT enabled ---
  // Tracing, profiling, and log forwarding are left off. Error events only.
  // No consoleIntegration / log breadcrumbs: server logs may contain PII.

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
