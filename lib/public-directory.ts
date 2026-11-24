import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { donationRequests } from "./schema";
import { reportHandledError } from "./sentry";

/**
 * Public Temple Directory (Part 3A) — privacy-safe read layer.
 *
 * The projection below is the ONLY data /temples may ever render. Contact
 * identity (name, email, phone), street-level address (street, line2, ZIP),
 * delivery instructions, requester notes, and internal admin notes are NEVER
 * selected, returned, or passed to any client component or public response.
 */
export type PublicTempleListing = {
  publicRef: string;
  templeName: string;
  city: string;
  state: string;
  templeWebsite: string | null;
  publicListingSummary: string | null;
  publicListingReviewedAt: Date | null;
};

export type DirectoryFilters = {
  /** US state code, e.g. "TX". Empty means all states. */
  state?: string;
  /** Free-text query matched against temple name or city. Empty means all. */
  q?: string;
};

const MAX_QUERY_LENGTH = 120;

/**
 * Returns a validated http(s) URL string, or null for anything else
 * (javascript:, data:, malformed, or non-http schemes are never linkified).
 */
export function toSafeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

/** Plain-text sanitizer for the admin-editable public summary. */
export function sanitizeListingSummary(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/[\r\n]+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 240);
}

function normalizeFilters(filters: DirectoryFilters): { state: string; q: string } {
  const rawState = (filters.state ?? "").trim().toUpperCase();
  const state = /^[A-Z]{2}$/.test(rawState) ? rawState : "";
  const q = (filters.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  return { state, q };
}

export async function getPublishedTemples(
  filters: DirectoryFilters = {}
): Promise<PublicTempleListing[]> {
  const db = getDb();
  if (!db) return [];
  const { state, q } = normalizeFilters(filters);

  const conditions = [
    eq(donationRequests.publicListingConsent, true),
    eq(donationRequests.publicListingStatus, "published"),
  ];
  if (state) conditions.push(eq(donationRequests.state, state));
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      // biome-ignore lint: drizzle or overload
      or(ilike(donationRequests.templeName, like), ilike(donationRequests.city, like))!
    );
  }

  try {
    const rows = await db
      .select({
        publicRef: donationRequests.publicRef,
        templeName: donationRequests.templeName,
        city: donationRequests.city,
        state: donationRequests.state,
        templeWebsite: donationRequests.templeWebsite,
        publicListingSummary: donationRequests.publicListingSummary,
        publicListingReviewedAt: donationRequests.publicListingReviewedAt,
      })
      .from(donationRequests)
      .where(and(...conditions))
      .orderBy(asc(donationRequests.templeName))
      .limit(500);

    return rows;
  } catch {
    // Never leak SQL, connection details, or submitted values: report a
    // fixed operation event, then throw a generic error for /temples to
    // degrade gracefully.
    reportHandledError("temple_directory_read", "/temples");
    throw new Error("Temple directory unavailable.");
  }
}

export async function countPublishedTemples(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(donationRequests)
      .where(
        and(
          eq(donationRequests.publicListingConsent, true),
          eq(donationRequests.publicListingStatus, "published")
        )
      );
    return n;
  } catch {
    reportHandledError("temple_directory_read", "/temples");
    throw new Error("Temple directory unavailable.");
  }
}
