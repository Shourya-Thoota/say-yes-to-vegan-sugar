import { and, eq, gte } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "./schema";

// In-memory fallback when DATABASE_URL is missing (dev/build only).
const memory = new Map<string, { count: number; resetAt: number }>();

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec: number };

function clientIpFromHeaders(headers: Headers): string {
  // Railway terminates TLS and sets x-forwarded-for. Take the last untrusted?
  // We trust the platform proxy chain conservatively: use the first entry only
  // for rate-limit bucketing, never for security decisions.
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 80);
  return "unknown";
}

export function bucketKey(prefix: string, headers: Headers): string {
  return `${prefix}:${clientIpFromHeaders(headers)}`;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / 1000 / windowSec) * windowSec * 1000);
  const db = getDb();
  if (!db) {
    const entry = memory.get(key);
    if (!entry || entry.resetAt <= now) {
      memory.set(key, { count: 1, resetAt: windowStart.getTime() + windowSec * 1000 });
      return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
    }
    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count += 1;
    return { allowed: true, remaining: limit - entry.count, retryAfterSec: 0 };
  }
  try {
    const rows = await db
      .select()
      .from(rateLimits)
      .where(and(eq(rateLimits.key, key), gte(rateLimits.windowStart, windowStart)))
      .limit(1);
    if (rows.length === 0) {
      await db.insert(rateLimits).values({ key, windowStart, count: 1 });
      return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
    }
    const row = rows[0];
    if (row.count >= limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((windowStart.getTime() + windowSec * 1000 - now) / 1000)
      );
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    const { sql } = await import("drizzle-orm");
    await db
      .update(rateLimits)
      .set({ count: sql`${rateLimits.count} + 1` })
      .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart)));
    return { allowed: true, remaining: limit - row.count - 1, retryAfterSec: 0 };
  } catch (err) {
    // Fail open for the limiter itself (do not block legitimate users on limiter errors).
    console.error("[rate-limit] error", err instanceof Error ? err.message : err);
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
}
