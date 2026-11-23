// Next.js instrumentation hook (stable in Next.js 15, no flag needed).
// Loads the Node.js Sentry config and wires automatic capture of errors from
// Server Components, route handlers, server actions, and middleware.
//
// No edge runtime is used by this application (no `export const runtime =
// "edge"` anywhere), so no sentry.edge.config.ts is provided.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Automatically captures unhandled server-side request errors. Events still
// pass through the shared beforeSend sanitizer.
export const onRequestError = Sentry.captureRequestError;
