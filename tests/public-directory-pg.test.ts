/**
 * Real-PostgreSQL integration coverage for Part 3A (public temple directory).
 *
 * Runs ONLY when a test database is explicitly provided:
 *   - TEST_DATABASE_URL is set, OR
 *   - DATABASE_URL is set AND RUN_PG_TESTS=1
 * Otherwise the whole suite skips cleanly.
 *
 * Safety: refuses production-like hosts; synthetic data only
 * (example.org, 10.222.x.x IPs, `pg-test-` idempotency keys); cleans up
 * only synthetic rows after each test.
 */
import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { donationRequests } from "../lib/schema";
import { getDb, getPool } from "../lib/db";
import { POST as requestsPost } from "../app/api/requests/route";
import {
  countPublishedTemples,
  getPublishedTemples,
  toSafeHttpUrl,
} from "../lib/public-directory";

const TEST_URL =
  process.env.TEST_DATABASE_URL ||
  (process.env.RUN_PG_TESTS === "1" ? process.env.DATABASE_URL : undefined);

const PROD_PATTERN = /railway|render\.com|neon\.tech|amazonaws|say-yes-to-vegan-sugar-production/i;

if (TEST_URL && PROD_PATTERN.test(TEST_URL)) {
  throw new Error(
    "Refusing to run Postgres integration tests against a production-like DATABASE_URL."
  );
}

const enabled = Boolean(TEST_URL);

if (enabled && TEST_URL) {
  process.env.DATABASE_URL = TEST_URL;
}

const pgDescribe = enabled ? describe : describe.skipIf(true);

// ---------------------------------------------------------------------------
// Helpers (synthetic data only)
// ---------------------------------------------------------------------------
const RUN_ID = `r${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36)}`.slice(
  0,
  12
);
let keyCounter = 0;
function synthKey(prefix: string): string {
  keyCounter += 1;
  return `pg-test-${RUN_ID}-${prefix}-${keyCounter}`.slice(0, 64);
}

let ipCounter = 200;
function freshIp(): string {
  ipCounter += 1;
  // 10.222.x.x is reserved for this suite.
  return `10.222.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function post(body: unknown, ip: string): Request {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function validDonation(key: string, extra: Record<string, unknown> = {}) {
  return {
    company: "",
    idempotencyKey: key,
    templeName: "Synthetic PG Directory Temple",
    templeWebsite: "",
    streetAddress: "1 Synthetic Way",
    addressLine2: "",
    city: "Houston",
    state: "TX",
    zipCode: "77001",
    contactName: "Synthetic Person",
    contactRole: "Trustee",
    contactEmail: "synthetic-pg-dir@example.org",
    contactPhone: "",
    preferredContact: "email",
    authorized: true,
    quantityPounds: 50,
    dateNeeded: "",
    intendedUse: ["prasadam"],
    otherUseExplanation: "",
    currentProduct: "",
    productPreferences: "",
    deliveryInstructions: "",
    additionalNotes: "",
    understandsNoGuarantee: true,
    privacyConsent: true,
    ...extra,
  };
}

async function cleanupSyntheticRows(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `DELETE FROM "request_status_history" WHERE "request_id" IN (SELECT "id" FROM "donation_requests" WHERE "contact_email" ILIKE '%@example.org' AND "idempotency_key" LIKE 'pg-test-%')`
  );
  await pool.query(
    `DELETE FROM "request_notes" WHERE "request_id" IN (SELECT "id" FROM "donation_requests" WHERE "contact_email" ILIKE '%@example.org' AND "idempotency_key" LIKE 'pg-test-%')`
  );
  await pool.query(
    `DELETE FROM "donation_requests" WHERE "contact_email" ILIKE '%@example.org' AND "idempotency_key" LIKE 'pg-test-%'`
  );
  await pool.query(
    `DELETE FROM "rate_limits" WHERE "key" LIKE '%10.222.%' OR "key" LIKE 'pg-test-%'`
  );
}

pgDescribe("public temple directory (real PostgreSQL, synthetic data)", () => {
  beforeAll(async () => {
    const pool = getPool();
    expect(pool).toBeTruthy();
    await pool!.query("SELECT 1");
  }, 30_000);

  afterEach(async () => {
    await cleanupSyntheticRows();
  });

  afterAll(async () => {
    await cleanupSyntheticRows();
    const pool = getPool();
    if (pool) await pool.end().catch(() => undefined);
  });

  it("migration added the opt-in columns, defaults, and status index", async () => {
    const pool = getPool()!;
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'donation_requests'
         AND column_name IN ('public_listing_consent','public_listing_consent_at','public_listing_status','public_listing_summary','public_listing_reviewed_by','public_listing_reviewed_at')
       ORDER BY column_name`
    );
    expect(cols.rows.map((r: { column_name: string }) => r.column_name)).toEqual([
      "public_listing_consent",
      "public_listing_consent_at",
      "public_listing_reviewed_at",
      "public_listing_reviewed_by",
      "public_listing_status",
      "public_listing_summary",
    ]);
    const idx = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'donation_requests_public_listing_status_idx'`
    );
    expect(idx.rows.length).toBe(1);
  }, 30_000);

  it("older rows without opt-in stay strictly private by default", async () => {
    const db = getDb()!;
    const key = synthKey("legacy");
    const res = await requestsPost(post(validDonation(key), freshIp()));
    expect(res.status).toBe(201);
    const rows = await db
      .select()
      .from(donationRequests)
      .where(eq(donationRequests.idempotencyKey, key))
      .limit(1);
    expect(rows.length).toBe(1);
    expect(rows[0].publicListingConsent).toBe(false);
    expect(rows[0].publicListingConsentAt).toBeNull();
    expect(rows[0].publicListingStatus).toBe("private");

    const listed = await getPublishedTemples({});
    expect(listed.find((t) => t.publicRef === rows[0].publicRef)).toBeUndefined();
  }, 30_000);

  it("opt-in submission becomes pending_review and stays unpublished until admin approval", async () => {
    const db = getDb()!;
    const key = synthKey("optin");
    const res = await requestsPost(
      post(validDonation(key, { publicListingConsent: true }), freshIp())
    );
    expect(res.status).toBe(201);
    const rows = await db
      .select()
      .from(donationRequests)
      .where(eq(donationRequests.idempotencyKey, key))
      .limit(1);
    expect(rows[0].publicListingConsent).toBe(true);
    expect(rows[0].publicListingConsentAt).toBeInstanceOf(Date);
    expect(rows[0].publicListingStatus).toBe("pending_review");

    // Pending review must not appear publicly.
    expect(
      (await getPublishedTemples({})).find((t) => t.publicRef === rows[0].publicRef)
    ).toBeUndefined();

    // Simulate admin publish (the action itself requires an admin session and
    // is covered by unit tests; here we verify the DB-level visibility gate).
    await db
      .update(donationRequests)
      .set({
        publicListingStatus: "published",
        publicListingSummary: "Requested vegan sugar for temple kitchen",
        publicListingReviewedBy: "synthetic-admin@example.org",
        publicListingReviewedAt: new Date(),
      })
      .where(eq(donationRequests.id, rows[0].id));

    const listed = await getPublishedTemples({});
    const entry = listed.find((t) => t.publicRef === rows[0].publicRef);
    expect(entry).toBeTruthy();
    // Privacy projection: exact safe key set, no PII.
    expect(Object.keys(entry!).sort()).toEqual(
      [
        "city",
        "publicListingReviewedAt",
        "publicListingSummary",
        "publicRef",
        "state",
        "templeName",
        "templeWebsite",
      ].sort()
    );
    expect(JSON.stringify(entry)).not.toContain("synthetic-pg-dir@example.org");
    expect(JSON.stringify(entry)).not.toContain("Synthetic Person");
    expect(JSON.stringify(entry)).not.toContain("1 Synthetic Way");
    expect(JSON.stringify(entry)).not.toContain("77001");

    // Unpublish hides the temple immediately.
    await db
      .update(donationRequests)
      .set({ publicListingStatus: "unpublished" })
      .where(eq(donationRequests.id, rows[0].id));
    expect(
      (await getPublishedTemples({})).find((t) => t.publicRef === rows[0].publicRef)
    ).toBeUndefined();
    expect(await countPublishedTemples()).toBe(0);
  }, 30_000);

  it("filters by state and search query, and rejects unsafe website schemes", async () => {
    const db = getDb()!;
    async function publishTemple(key: string, patch: Record<string, unknown>) {
      const res = await requestsPost(
        post(validDonation(key, { publicListingConsent: true, ...patch }), freshIp())
      );
      expect(res.status).toBe(201);
      const rows = await db
        .select()
        .from(donationRequests)
        .where(eq(donationRequests.idempotencyKey, key))
        .limit(1);
      await db
        .update(donationRequests)
        .set({
          publicListingStatus: "published",
          publicListingReviewedBy: "synthetic-admin@example.org",
          publicListingReviewedAt: new Date(),
        })
        .where(eq(donationRequests.id, rows[0].id));
      return rows[0].publicRef;
    }

    // Public submissions must reject javascript: URLs at validation (422).
    const hostileRes = await requestsPost(
      post(
        validDonation(synthKey("ca-hostile"), {
          publicListingConsent: true,
          templeName: "Synthetic Fremont Mandir",
          city: "Fremont",
          state: "CA",
          templeWebsite: "javascript:alert(1)",
        }),
        freshIp()
      )
    );
    expect(hostileRes.status).toBe(422);

    const txKey = synthKey("tx");
    const refTX = await publishTemple(txKey, {
      templeName: "Synthetic Austin Mandir",
      city: "Austin",
      state: "TX",
      templeWebsite: "https://austin-mandir.example.org",
    });
    const caKey = synthKey("ca");
    const refCA = await publishTemple(caKey, {
      templeName: "Synthetic Fremont Mandir",
      city: "Fremont",
      state: "CA",
      templeWebsite: "https://fremont-mandir.example.org",
    });
    // Defense-in-depth: hostile value written directly in PostgreSQL
    // (bypassing validation) must never become a clickable link.
    await db
      .update(donationRequests)
      .set({ templeWebsite: "javascript:alert(1)" })
      .where(eq(donationRequests.idempotencyKey, caKey));

    const txOnly = await getPublishedTemples({ state: "TX" });
    expect(txOnly.map((t) => t.publicRef)).toContain(refTX);
    expect(txOnly.map((t) => t.publicRef)).not.toContain(refCA);

    const byName = await getPublishedTemples({ q: "fremont" });
    expect(byName.map((t) => t.publicRef)).toContain(refCA);
    expect(byName.map((t) => t.publicRef)).not.toContain(refTX);

    const hostile = (await getPublishedTemples({ q: "Fremont" })).find(
      (t) => t.publicRef === refCA
    )!;
    expect(hostile.templeWebsite).toBe("javascript:alert(1)");
    expect(toSafeHttpUrl(hostile.templeWebsite)).toBeNull();
  }, 30_000);
});
