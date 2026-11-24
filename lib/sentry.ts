// Sentry reporting helpers.
//
// - Active only with a DSN in production. Local dev and DSN-less builds are
//   silent; the app behaves identically with or without monitoring.
// - Handled failures are reported with a FIXED message plus safe tags only.
//   The original exception is NEVER attached or stringified (DB errors may
//   contain SQL, connection info, or submitted values).
// - Callers that rethrow after reporting must throw a NEW generic error (see
//   updateRequestStatus), so automatic hooks can only ever see safe text.
//   That replaces any dedupe bookkeeping.

import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryEvent, sanitizeUrl } from "./sentry-sanitize";

export const SENTRY_OPERATIONS = [
  "donation_request_create",
  "support_offer_create",
  "contact_inquiry_create",
  "admin_request_status_update",
  "admin_public_listing_update",
  "temple_directory_read",
] as const;

export type SentryOperation = (typeof SENTRY_OPERATIONS)[number];

export function getSentryDsn(): string | null {
  const dsn = (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
  return dsn.length > 0 ? dsn : null;
}

/** True only when events should actually leave the process. */
export function isSentryEnabled(): boolean {
  return getSentryDsn() !== null && process.env.NODE_ENV === "production";
}

/** Shared init options: error events only, no breadcrumbs, minimal collection. */
export function getSharedSentryOptions() {
  return {
    // Breadcrumbs (console, HTTP, navigation) can embed user text, so they
    // are disabled entirely rather than scrubbed per-item.
    maxBreadcrumbs: 0,
    // SDK v11: everything not needed to debug a broken submission is off.
    // beforeSend is the second layer.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [] as never[],
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
  };
}

/** Shared beforeSend: sanitize. Never throws. */
export function sentryBeforeSend(event: any): any {
  try {
    return sanitizeSentryEvent(event);
  } catch {
    return event;
  }
}

/**
 * Report a handled failure (e.g. a 500 converted into a generic public
 * response) as a sanitized operation-level event. Never throws.
 */
export function reportHandledError(operation: SentryOperation, routePattern?: string): void {
  try {
    if (!isSentryEnabled()) return;
    const err = new Error(`sentry:${operation}`);
    err.name = "HandledOperationError";
    Sentry.withScope((scope) => {
      scope.setFingerprint([operation]);
      scope.setTag("operation", operation);
      if (routePattern) {
        const clean = sanitizeUrl(routePattern);
        if (clean) scope.setTag("route", clean);
      }
      scope.setLevel("error");
      Sentry.captureException(err);
    });
  } catch {
    // Monitoring must never affect success/failure behavior.
  }
}

/** Admin-initiated synthetic verification event (guarded test action). */
export function captureVerificationEvent(): void {
  try {
    if (!isSentryEnabled()) return;
    Sentry.withScope((scope) => {
      scope.setFingerprint(["sentry-verification"]);
      scope.setTag("operation", "sentry_verification");
      scope.setLevel("info");
      Sentry.captureMessage("sentry:verification:synthetic-test-event");
    });
  } catch {
    // never break admin flows
  }
}
