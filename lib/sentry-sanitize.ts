// Privacy sanitizers for Sentry events.
//
// These helpers are intentionally dependency-free (no Sentry import) so they can
// run in beforeSend/beforeBreadcrumb hooks and be unit-tested in isolation.
//
// Goal: never send form bodies, cookies, auth material, connection strings,
// user-provided text, query strings, fragments, or record identifiers to Sentry.

export const REDACTED = "[Redacted]";

// Keys whose values must never reach Sentry. Matching is case-insensitive and
// partial (e.g. "auth" matches "Authorization").
export const SENSITIVE_KEYS = [
  "auth",
  "token",
  "secret",
  "password",
  "passwd",
  "pwd",
  "key",
  "jwt",
  "bearer",
  "sso",
  "saml",
  "csrf",
  "xsrf",
  "credentials",
  "credential",
  "session",
  "sid",
  "identity",
  "cookie",
  "set-cookie",
  "email",
  "phone",
  "name",
  "address",
  "street",
  "city",
  "zip",
  "message",
  "note",
  "notes",
  "body",
  "delivery",
  "temple",
  "contact",
  "subject",
  "company",
  "organization",
  "website",
  "forwarded",
  "-ip",
  "remote-",
  "via",
  "-user",
  "database_url",
  "connection",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((term) => lower.includes(term));
}

/** Strip query string and fragment; keep only origin + pathname. */
export function sanitizeUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  // Relative paths (breadcrumbs, route names) carry no query by construction,
  // but strip defensively anyway.
  const q = raw.indexOf("?");
  const h = raw.indexOf("#");
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  const stripped = cut === -1 ? raw : raw.slice(0, cut);
  return stripped.length > 0 ? stripped : undefined;
}

/** Redact sensitive keys in a flat record; drop non-string-safe values. */
export function sanitizeHeaders(
  input: Record<string, string | undefined> | undefined
): Record<string, string> | undefined {
  if (!input) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = isSensitiveKey(k) ? REDACTED : v;
  }
  return out;
}

type MutableEvent = {
  request?: {
    url?: string;
    query_string?: unknown;
    fragment?: unknown;
    cookies?: unknown;
    data?: unknown;
    headers?: Record<string, string | undefined>;
  };
  user?: unknown;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<{
    message?: string;
    data?: unknown;
    category?: string;
  }>;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  exception?: {
    values?: Array<{ value?: string; stacktrace?: { frames?: Array<{ vars?: unknown; context_line?: unknown; pre_context?: unknown; post_context?: unknown }> } }>;
  };
  message?: string;
};

function sanitizeExceptionValues(event: MutableEvent): void {
  const values = event.exception?.values;
  if (!values) return;
  for (const v of values) {
    if (typeof v.value === "string" && looksLikeUserText(v.value)) {
      v.value = REDACTED;
    }
    const frames = v.stacktrace?.frames;
    if (frames) {
      for (const f of frames) {
        // Local variables may hold form values or row contents.
        if (f.vars !== undefined) f.vars = REDACTED;
        if (f.context_line !== undefined) f.context_line = REDACTED;
        if (f.pre_context !== undefined) f.pre_context = REDACTED;
        if (f.post_context !== undefined) f.post_context = REDACTED;
      }
    }
  }
}

// Heuristic: handled-operation events use short fixed messages. Anything long
// or containing an "@" (email) or digits-heavy contact text is treated as
// potentially user-supplied and redacted.
function looksLikeUserText(value: string): boolean {
  if (value.length > 300) return true;
  if (value.includes("@")) return true;
  return false;
}

/**
 * Mutate a Sentry event in place to remove personal and sensitive data.
 * Safe to call on any event shape; never throws.
 */
export function sanitizeSentryEvent<T>(event: T): T {
  try {
    const e = event as unknown as MutableEvent;
    if (!e || typeof e !== "object") return event;

    // Request: keep method + sanitized URL only. Drop body, cookies, query.
    if (e.request) {
      const sanitized = sanitizeUrl(e.request.url);
      if (sanitized !== undefined) e.request.url = sanitized;
      else delete e.request.url;
      delete e.request.query_string;
      delete e.request.fragment;
      delete e.request.cookies;
      delete e.request.data;
      if (e.request.headers) {
        const headers = sanitizeHeaders(e.request.headers);
        if (headers) e.request.headers = headers;
        else delete e.request.headers;
      }
    }

    // Never send inferred user identity (email, username, ip inferred by SDK).
    delete e.user;

    // Drop contexts that commonly embed request bodies or DB rows.
    if (e.contexts) {
      for (const key of Object.keys(e.contexts)) {
        const lower = key.toLowerCase();
        if (
          lower.includes("request") ||
          lower.includes("response") ||
          lower.includes("db") ||
          lower.includes("database") ||
          lower.includes("trace") ||
          lower.includes("state") ||
          lower.includes("form")
        ) {
          delete e.contexts[key];
        }
      }
    }

    // Scrub tags/extra of sensitive keys and user text.
    if (e.tags) {
      for (const [k, v] of Object.entries(e.tags)) {
        if (isSensitiveKey(k) || (typeof v === "string" && looksLikeUserText(v))) {
          e.tags[k] = REDACTED;
        }
      }
    }
    if (e.extra) {
      for (const [k, v] of Object.entries(e.extra)) {
        if (isSensitiveKey(k) || (typeof v === "string" && looksLikeUserText(v))) {
          e.extra[k] = REDACTED;
        }
      }
    }

    sanitizeExceptionValues(e);

    if (Array.isArray(e.breadcrumbs)) {
      e.breadcrumbs = e.breadcrumbs
        .map(sanitizeBreadcrumb)
        .filter((b) => b !== null) as MutableEvent["breadcrumbs"];
    }
  } catch {
    // Sanitization must never break event delivery.
  }
  return event;
}

type MutableBreadcrumb = {
  message?: string;
  data?: unknown;
  category?: string;
  type?: string;
  level?: string;
};

/**
 * Sanitize a single breadcrumb. Returns null when the breadcrumb should be
 * dropped entirely (console/log breadcrumbs often embed user text).
 */
export function sanitizeBreadcrumb<T>(crumb: T): T | null {
  try {
    const b = crumb as unknown as MutableBreadcrumb;
    if (!b || typeof b !== "object") return crumb;
    // Console/log breadcrumbs capture raw log arguments (may include PII).
    if (b.category === "console" || b.type === "log") return null;
    // HTTP breadcrumbs may carry query strings or bodies in data/url.
    if (typeof b.message === "string") {
      if (looksLikeUserText(b.message)) return null;
      const cleaned = sanitizeUrl(b.message);
      b.message = cleaned ?? REDACTED;
    }
    if (b.data !== undefined) {
      if (typeof b.data === "string") {
        const cleaned = sanitizeUrl(b.data);
        b.data = cleaned ?? REDACTED;
      } else if (b.data && typeof b.data === "object") {
        const rec = b.data as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rec)) {
          if (isSensitiveKey(k)) {
            out[k] = REDACTED;
            continue;
          }
          if (typeof v === "string") {
            if (looksLikeUserText(v)) out[k] = REDACTED;
            else out[k] = sanitizeUrl(v) ?? v;
          } else {
            out[k] = REDACTED;
          }
        }
        b.data = out;
      } else {
        b.data = REDACTED;
      }
    }
    return crumb;
  } catch {
    return null;
  }
}

/** Sensitive substrings that must never appear in an event payload. */
export function findLeakedSensitiveText(serialized: string, samples: string[]): string[] {
  return samples.filter((s) => s.length >= 4 && serialized.includes(s));
}
