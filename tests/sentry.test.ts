/**
 * Sentry integration tests (synthetic data only).
 *
 * Covers: disabled-without-DSN, request/user/extra stripping, query
 * stripping, unknown-tag dropping, user-text exclusion, raw DB errors never
 * forwarded by handled-error helpers, safe metadata retained, and monitoring
 * failures never changing app behavior.
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

import { getSharedSentryOptions, isSentryEnabled, reportHandledError, sentryBeforeSend } from "../lib/sentry";
import { sanitizeSentryEvent, sanitizeUrl } from "../lib/sentry-sanitize";

function enableMonitoring() {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o123.ingest.sentry.io/456");
  vi.stubEnv("NODE_ENV", "production");
}

function disableMonitoring() {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
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
    reportHandledError("donation_request_create", "/api/requests");
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it("is disabled in non-production even with a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o123.ingest.sentry.io/456");
    vi.stubEnv("NODE_ENV", "development");
    expect(isSentryEnabled()).toBe(false);
  });
});

describe("shared init options", () => {
  it("disables breadcrumbs and risky collection", () => {
    const opts = getSharedSentryOptions();
    expect(opts.maxBreadcrumbs).toBe(0);
    expect(opts.dataCollection.userInfo).toBe(false);
    expect(opts.dataCollection.cookies).toBe(false);
    expect(opts.dataCollection.httpHeaders).toBe(false);
    expect(opts.dataCollection.urlQueryParams).toBe(false);
  });
});

describe("URL sanitization", () => {
  it("strips query strings and fragments", () => {
    expect(sanitizeUrl("https://example.org/api/x?email=a@b.org#frag")).toBe("https://example.org/api/x");
    expect(sanitizeUrl("/admin/requests/abc?tab=1")).toBe("/admin/requests/abc");
    expect(sanitizeUrl("/api/health")).toBe("/api/health");
  });
});

describe("event sanitization", () => {
  it("keeps method + clean URL; drops body, cookies, headers, user, extra, unknown tags", () => {
    const event = {
      request: {
        url: "https://example.org/api/requests?email=jane@example.org",
        method: "POST",
        query_string: "email=jane@example.org",
        fragment: "x",
        cookies: "session=abc",
        data: { contactEmail: "jane@example.org" },
        headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
      },
      user: { email: "jane@example.org", id: "123" },
      contexts: { db: { statement: "INSERT ..." }, runtime: { name: "node" } },
      tags: { operation: "donation_request_create", contactEmail: "jane@example.org" },
      extra: { deliveryInstructions: "Leave at gate" },
      breadcrumbs: [{ message: "console log with jane@example.org" }],
    };
    sanitizeSentryEvent(event);
    expect(event.request.url).toBe("https://example.org/api/requests");
    expect(event.request.method).toBe("POST");
    expect(event.request).not.toHaveProperty("query_string");
    expect(event.request).not.toHaveProperty("cookies");
    expect(event.request).not.toHaveProperty("data");
    expect(event.request).not.toHaveProperty("headers");
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("extra");
    expect(event).not.toHaveProperty("breadcrumbs");
    expect(event.contexts).not.toHaveProperty("db");
    expect(event.contexts).toHaveProperty("runtime");
    expect(event.tags?.operation).toBe("donation_request_create");
    expect(event.tags).not.toHaveProperty("contactEmail");
  });

  it("redacts exception values that look like user text and strips frame vars", () => {
    const event = {
      exception: {
        values: [
          { value: "a".repeat(400), stacktrace: { frames: [{ vars: { pwd: "x" } }] } },
          { value: "short fixed message" },
        ],
      },
    };
    sanitizeSentryEvent(event);
    const values = event.exception.values;
    expect(values[0]?.value).toBe("[Redacted]");
    expect(values[0]?.stacktrace?.frames?.[0]?.vars).toBe("[Redacted]");
    expect(values[1]?.value).toBe("short fixed message");
  });
});

describe("handled-error helper privacy", () => {
  it("forwards only a fixed message plus safe tags", () => {
    enableMonitoring();
    const scope = fakeScope();
    sentryMock.withScope.mockImplementationOnce((fn: (s: unknown) => void) => fn(scope));

    reportHandledError("donation_request_create", "/api/requests");

    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    const captured = sentryMock.captureException.mock.calls[0][0] as Error;
    expect(captured.message).toBe("sentry:donation_request_create");
    expect(captured.name).toBe("HandledOperationError");
    expect(scope.calls.tags.operation).toBe("donation_request_create");
    expect(scope.calls.tags.route).toBe("/api/requests");
    expect(scope.calls.fingerprint).toEqual(["donation_request_create"]);
  });

  it("beforeSend keeps genuine events, sanitized", () => {
    const out = sentryBeforeSend({ request: { url: "https://x/api/requests?email=a@b.org", method: "POST" } });
    expect(out.request.url).toBe("https://x/api/requests");
    expect(out.request).not.toHaveProperty("headers");
  });
});

describe("monitoring failures never change app behavior", () => {
  it("reportHandledError swallows transport errors", () => {
    enableMonitoring();
    sentryMock.captureException.mockImplementationOnce(() => {
      throw new Error("transport down");
    });
    expect(() => reportHandledError("donation_request_create", "/api/requests")).not.toThrow();
  });
});
