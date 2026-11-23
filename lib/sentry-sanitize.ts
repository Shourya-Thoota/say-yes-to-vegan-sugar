// Privacy sanitizers for Sentry events.
//
// Dependency-free (no Sentry import) so they run inside beforeSend and stay
// unit-testable in isolation.
//
// Strategy is deletion, not redaction lists: request bodies, cookies, headers,
// query strings, user identity, and extras never leave the process. What
// remains is the fixed operation message plus a small allowlist of safe tags.

export const REDACTED = "[Redacted]";

/** Strip query string and fragment; keep only origin + pathname. */
export function sanitizeUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const q = raw.indexOf("?");
  const h = raw.indexOf("#");
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  const stripped = cut === -1 ? raw : raw.slice(0, cut);
  return stripped.length > 0 ? stripped : undefined;
}

type MutableEvent = {
  request?: {
    url?: string;
    method?: string;
    query_string?: unknown;
    fragment?: unknown;
    cookies?: unknown;
    data?: unknown;
    headers?: unknown;
  };
  user?: unknown;
  contexts?: Record<string, unknown>;
  tags?: Record<string, string>;
  extra?: unknown;
  exception?: {
    values?: Array<{
      value?: string;
      stacktrace?: {
        frames?: Array<{ vars?: unknown; context_line?: unknown; pre_context?: unknown; post_context?: unknown }>;
      };
    }>;
  };
  breadcrumbs?: unknown;
};

// Tags set by reportHandledError. Anything else (SDK defaults included) is
// dropped so unexpected values can never carry PII.
const SAFE_TAGS = new Set(["operation", "route"]);

// Contexts that may embed request bodies or DB rows.
const RISKY_CONTEXTS = ["request", "response", "db", "database", "trace", "state", "form"];

// Heuristic for automatic captures: handled-operation events use short fixed
// messages, so anything long or containing "@" is treated as potentially
// user-supplied and redacted.
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

    // Request: keep method + sanitized URL only.
    if (e.request) {
      const sanitized = sanitizeUrl(e.request.url);
      const method = e.request.method;
      e.request = method ? { url: sanitized, method } : { url: sanitized };
      if (e.request.url === undefined) delete e.request.url;
    }

    // Never send inferred user identity.
    delete e.user;

    // Breadcrumbs are disabled via maxBreadcrumbs: 0, but drop defensively.
    delete e.breadcrumbs;

    // We never use `extra`; drop it wholesale rather than scrubbing keys.
    delete e.extra;

    if (e.contexts) {
      for (const key of Object.keys(e.contexts)) {
        if (RISKY_CONTEXTS.some((r) => key.toLowerCase().includes(r))) {
          delete e.contexts[key];
        }
      }
    }

    if (e.tags) {
      for (const key of Object.keys(e.tags)) {
        if (!SAFE_TAGS.has(key)) delete e.tags[key];
      }
    }

    const values = e.exception?.values;
    if (values) {
      for (const v of values) {
        if (typeof v.value === "string" && looksLikeUserText(v.value)) {
          v.value = REDACTED;
        }
        const frames = v.stacktrace?.frames;
        if (frames) {
          for (const f of frames) {
            // Defensive: stackFrameVariables/context lines are already off in
            // init, so these are normally absent.
            if (f.vars !== undefined) f.vars = REDACTED;
            if (f.context_line !== undefined) f.context_line = REDACTED;
            if (f.pre_context !== undefined) f.pre_context = REDACTED;
            if (f.post_context !== undefined) f.post_context = REDACTED;
          }
        }
      }
    }
  } catch {
    // Sanitization must never break event delivery.
  }
  return event;
}
