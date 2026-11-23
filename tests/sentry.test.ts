/**
 * Sentry integration tests (synthetic data only).
 *
 * Covers: disabled-without-DSN, PII/sensitive stripping, cookie + auth
 * header removal, query/fragment stripping, breadcrumb sanitization,
 * user-text exclusion, raw DB errors never forwarded by handled-error
 * helpers, safe metadata retained, and monitoring failures never changing
 * app behavior.
 *
 * These tests verify payload SHAPING only. They do not prove production
 * event delivery — that requires a configured DSN and dashboard check.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const sentryMock = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentryMock);

import {
  isSentryEnabled,
  reportHandledError,
  sentryBeforeBreadcrumb,
  sentryBeforeSend,
  wasManuallyReported,
} from "../lib/sentry";
import {
  findLeakedSensitiveText,
  sanitizeBreadcrumb,
  sanitizeSentryEvent,
  sanitizeUrl,
} from "../lib/sentry-sanitize";

const DB_ERROR_TEXT =
  "duplicate key value violates unique constraint (templeName)=(Sri Temple) " +
  "connection postgresql://admin:s3cret@db.internal:5432/vegansugar contact jane@example.org";

function enableMonitoring() {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o123.ingest.sentry.io/456");
  vi.stubEnv("NODE_ENV", "production");
}

function disableMonitoring() {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
  vi.stubEnv("SENTRY_DSN", "");
  vi.stubEnv("NODE_ENV", "test");
}

function fakeScope() {
  const calls: { tags: Record<string, string>; fingerprint: string[]; level?: string } = {
    tags: {},
    fingerprint: [],
  };
  return {
    calls,
    setTag: (k: string, v: string) => {
      calls.tags[k] = v;
    },
    setFingerprint: (fp: string[]) => {
      calls.fingerprint = fp;
    },
    setLevel: (level: string) => {
      calls.level = level;
    },
  };
}

beforeEach(() => {
  sentryMock.captureException.mockReset();
  sentryMock.captureMessage.mockReset();
  sentryMock.withScope.mockImplementation((fn: (s: unknown) => void) => fn(fakeScope()));
  disableMonitoring();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("monitoring disabled without a DSN", () => {
  it("is disabled when no DSN is configured", () => {
    expect(isSentryEnabled()).toBe(false);
  });

  it("reportHandledError is a no-op without a DSN", () => {
    reportHandledError("donation_request_create", "persistence", new Error(DB_ERROR_TEXT));
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it("is disabled in non-production even with a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o123.ingest.sentry.io/456");
    vi.stubEnv("NODE_ENV", "development");
    expect(isSentryEnabled()).toBe(false);
  });
});

describe("URL sanitization", () => {
  it("strips query strings and fragments", () => {
    expect(sanitizeUrl("https://example.org/api/x?email=a@b.org#frag")).toBe(
      "https://example.org/api/x"
    );
    expect(sanitizeUrl("/admin/requests/abc?tab=1")).toBe("/admin/requests/abc");
    expect(sanitizeUrl("/api/health")).toBe("/api/health");
  });
});

describe("event sanitization", () => {
  it("removes request body, cookies, query, user identity; redacts auth headers", () => {
    const event = {
      request: {
        url: "https://example.org/api/requests?email=jane@example.org",
        method: "POST",
        query_string: "email=jane@example.org",
        fragment: "x",
        cookies: "session=abc; theme=light",
        data: { contactName: "Jane Doe", contactEmail: "jane@example.org" },
        headers: {
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
          Cookie: "session=abc",
        },
      },
      user: { email: "jane@example.org", id: "123", ip_address: "1.2.3.4" },
      contexts: { db: { statement: "INSERT ..." }, runtime: { name: "node" } },
      tags: { contactEmail: "jane@example.org", operation: "donation_request_create" },
      extra: { deliveryInstructions: "Leave at gate", attempt: 1 },
      message: "short fixed message",
    };
    sanitizeSentryEvent(event);
    expect(event.request.url).toBe("https://example.org/api/requests");
    expect(event.request).not.toHaveProperty("query_string");
    expect(event.request).not.toHaveProperty("cookies");
    expect(event.request).not.toHaveProperty("data");
    expect(event.request.headers?.Authorization).toBe("[Redacted]");
    expect(event.request.headers?.Cookie).toBe("[Redacted]");
    expect(event.request.headers?.["Content-Type"]).toBe("application/json");
    expect(event).not.toHaveProperty("user");
    expect(event.contexts).not.toHaveProperty("db");
    expect(event.tags?.contactEmail).toBe("[Redacted]");
    expect(event.tags?.operation).toBe("donation_request_create");
    expect(event.extra?.deliveryInstructions).toBe("[Redacted]");
  });

  it("redacts exception values that look like user text and strips frame vars", () => {
    const longUserText = "a".repeat(400);
    const event = {
      exception: {
        values: [
          {
            value: longUserText,
            stacktrace: { frames: [{ vars: { pwd: "x" }, context_line: "secret" }] },
          },
        ],
      },
    };
    sanitizeSentryEvent(event);
    expect(event.exception.values[0].value).toBe("[Redacted]");
    expect(event.exception.values[0].stacktrace.frames[0].vars).toBe("[Redacted]");
  });
});

describe("breadcrumb sanitization", () => {
  it("drops console/log breadcrumbs and redacts http data", () => {
    expect(sanitizeBreadcrumb({ category: "console", message: "hello" })).toBeNull();
    const crumb = sanitizeBreadcrumb({
      category: "http",
      message: "https://example.org/api/x?token=abc",
      data: { url: "https://example.org/api/x?token=abc", email: "a@b.org", status_code: 200 },
    }) as { message: string; data: Record<string, unknown> };
    expect(crumb.message).toBe("https://example.org/api/x");
    expect(crumb.data.email).toBe("[Redacted]");
  });
});

describe("handled-error helper privacy", () => {
  it("forwards only a fixed message plus safe metadata, never raw DB text", () => {
    enableMonitoring();
    const scope = fakeScope();
    sentryMock.withScope.mockImplementationOnce((fn: (s: unknown) => void) => fn(scope));

    const raw = new Error(DB_ERROR_TEXT);
    reportHandledError("donation_request_create", "persistence", raw, "/api/requests");

    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    const captured = sentryMock.captureException.mock.calls[0][0] as Error;
    const serialized = JSON.stringify({
      message: captured.message,
      tags: scope.calls.tags,
      fingerprint: scope.calls.fingerprint,
    });
    // Fixed message only.
    expect(captured.message).toBe("sentry:donation_request_create:persistence");
    // None of the DB error contents leak.
    expect(
      findLeakedSensitiveText(serialized, [
        "Sri Temple",
        "s3cret",
        "db.internal",
        "jane@example.org",
        "duplicate key",
      ])
    ).toEqual([]);
    // Safe metadata retained.
    expect(scope.calls.tags.operation).toBe("donation_request_create");
    expect(scope.calls.tags.failure_category).toBe("persistence");
    expect(scope.calls.tags.route).toBe("/api/requests");
  });

  it("does not interpolate user input into messages", () => {
    enableMonitoring();
    reportHandledError("contact_inquiry_create", "persistence", new Error("user typed ouch"), "/api/contact");
    const captured = sentryMock.captureException.mock.calls[0][0] as Error;
    expect(captured.message).not.toContain("ouch");
  });

  it("marks the original error so automatic hooks drop the duplicate", () => {
    enableMonitoring();
    const raw = new Error(DB_ERROR_TEXT);
    reportHandledError("support_offer_create", "persistence", raw, "/api/support");
    expect(wasManuallyReported({ originalException: raw })).toBe(true);
    expect(
      sentryBeforeSend({ request: { url: "https://x/api/support" } }, { originalException: raw })
    ).toBeNull();
  });
});

describe("beforeSend noise filtering", () => {
  it("drops health and readiness probe events", () => {
    expect(
      sentryBeforeSend({ request: { url: "https://x/api/health" } }, {})
    ).toBeNull();
    expect(sentryBeforeSend({ request: { url: "https://x/api/ready" } }, {})).toBeNull();
  });

  it("keeps genuine events (sanitized)", () => {
    const out = sentryBeforeSend(
      { request: { url: "https://x/api/requests?email=a@b.org", cookies: "s=1" } },
      {}
    );
    expect(out).not.toBeNull();
    expect(out.request.url).toBe("https://x/api/requests");
  });

  it("beforeBreadcrumb drops console noise", () => {
    expect(sentryBeforeBreadcrumb({ category: "console", message: "x" })).toBeNull();
  });
});

describe("monitoring failures never change app behavior", () => {
  it("reportHandledError swallows transport errors", () => {
    enableMonitoring();
    sentryMock.captureException.mockImplementationOnce(() => {
      throw new Error("transport down");
    });
    expect(() =>
      reportHandledError("donation_request_create", "persistence", new Error("db down"))
    ).not.toThrow();
  });
});
