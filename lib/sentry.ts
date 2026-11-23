// Sentry reporting helpers.
//
// - Monitoring is active only when a DSN is configured AND the app runs in
//   production. Local development and builds without a DSN are silent.
// - Handled failures in critical operations are reported with a FIXED message
//   plus an allowlist of safe metadata (operation, category, route pattern).
//   The original exception is NEVER attached and its text is NEVER forwarded,
//   because DB errors may contain SQL, connection info, or submitted values.
// - Errors already reported via reportHandledError are marked so beforeSend
//   can drop the duplicate capture from onRequestError/auto-instrumentation.

import * as Sentry from "@sentry/nextjs";
import {
  sanitizeBreadcrumb,
  sanitizeSentryEvent,
  sanitizeUrl,
} from "./sentry-sanitize";

export const SENTRY_OPERATIONS = [
  "donation_request_create",
  "support_offer_create",
  "contact_inquiry_create",
  "admin_request_status_update",
] as const;

export type SentryOperation = (typeof SENTRY_OPERATIONS)[number];

export type SentryFailureCategory = "persistence" | "unexpected";

const REPORTED = Symbol.for("temple-initiative.sentry-reported");

export function getSentryDsn(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
  return dsn.trim().length > 0 ? dsn.trim() : null;
}

/** True only when events should actually leave the process. */
export function isSentryEnabled(): boolean {
  return getSentryDsn() !== null && process.env.NODE_ENV === "production";
}

function markReported(err: unknown): void {
  try {
    if (err !== null && (typeof err === "object" || typeof err === "function")) {
      (err as Record<symbol, boolean>)[REPORTED] = true;
    }
  } catch {
    // never break the request path
  }
}

/** beforeSend predicate: drop duplicates of manually reported errors. */
export function wasManuallyReported(hint: unknown): boolean {
  try {
    const original = (hint as { originalException?: unknown } | null)?.originalException;
    if (original !== null && (typeof original === "object" || typeof original === "function")) {
      return (original as Record<symbol, unknown>)[REPORTED] === true;
    }
  } catch {
    // fall through
  }
  return false;
}

/** Route patterns whose errors are routine noise and must not page anyone. */
const IGNORED_ROUTE_PATTERNS = ["/api/health", "/api/ready"];

function isIgnoredRoute(eventUrl: string | undefined): boolean {
  if (!eventUrl) return false;
  return IGNORED_ROUTE_PATTERNS.some((p) => eventUrl.includes(p));
}

/**
 * Shared beforeSend for every runtime: sanitize, drop duplicates, drop
 * health/readiness noise. Never throws.
 */
export function sentryBeforeSend(event: any, hint?: unknown): any {
  try {
    if (wasManuallyReported(hint)) return null;
    const url =
      typeof event?.request?.url === "string" ? event.request.url : undefined;
    if (isIgnoredRoute(url)) return null;
    // Sanitize in place, then return the (mutated) event.
    return sanitizeSentryEvent(event);
  } catch {
    return event;
  }
}

/**
 * Shared beforeBreadcrumb: sanitize, drop console/log noise. Never throws.
 */
export function sentryBeforeBreadcrumb(breadcrumb: any): any {
  try {
    return sanitizeBreadcrumb(breadcrumb);
  } catch {
    return null;
  }
}

/**
 * Report an unexpected handled failure (e.g. a 500 we convert into a generic
 * public response) as a sanitized operation-level event.
 *
 * - Fixed message: `sentry:<operation>:<category>` — no user input, no refs.
 * - Safe metadata only: operation, category, sanitized route pattern.
 * - `originalError` (if given) is marked as reported so automatic hooks drop
 *   their duplicate, and is NEVER attached or stringified into the event.
 * - Never throws; monitoring failures must not change app behavior.
 */
export function reportHandledError(
  operation: SentryOperation,
  category: SentryFailureCategory,
  originalError?: unknown,
  routePattern?: string
): void {
  try {
    if (!isSentryEnabled()) return;
    if (originalError !== undefined) markReported(originalError);
    const err = new Error(`sentry:${operation}:${category}`);
    err.name = "HandledOperationError";
    Sentry.withScope((scope) => {
      scope.setFingerprint([operation, category]);
      scope.setTag("operation", operation);
      scope.setTag("failure_category", category);
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

/**
 * Capture an admin-initiated synthetic verification event. Only sends when
 * monitoring is enabled; the message carries no personal information.
 * Used by the guarded admin test action (SENTRY_TEST_ENABLED=true).
 */
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
