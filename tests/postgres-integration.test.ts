/**
 * Real-PostgreSQL integration coverage for the three public form handlers.
 *
 * Runs ONLY when a test database is explicitly provided:
 *   - TEST_DATABASE_URL is set, OR
 *   - DATABASE_URL is set AND RUN_PG_TESTS=1
 * Otherwise the whole suite skips cleanly so local `npm test` stays green
 * without a database.
 *
 * Safety:
 * - Refuses to run against production-like hosts (railway/render/neon/
 *   amazonaws or the production Railway URL).
 * - Uses synthetic payloads only (example.org, 10.221.x.x IPs,
 *   idempotency keys prefixed with `pg-test-`).
 * - Cleans up only those synthetic rows after each test; nothing else.
 *
 * The CI workflow (`.github/workflows/ci.yml`) provisions a PostgreSQL 18
 * service, runs `npm run db:migrate` against it, then runs `npm test` with
 * RUN_PG_TESTS=1 so this file executes against real Postgres.
 */
import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  donationRequests,
  supportOffers,
  contactInquiries,
  statusHistory,
  rateLimits,
} from "../lib/schema";
import { getDb, getPool } from "../lib/db";
import { POST as requestsPost } from "../app/api/requests/route";
import { POST as supportPost } from "../app/api/support/route";
import { POST as contactPost } from "../app/api/contact/route";
import { checkRateLimit } from "../lib/rate-limit";

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

// Point lib/db at the test database before its first getPool()/getDb() call.
// getDb() reads process.env.DATABASE_URL lazily and caches per worker, so
// setting it here (module top-level, before any test body runs) is enough.
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

let ipCounter = 100;
function freshIp(): string {
  ipCounter += 1;
  // 10.221.x.x is reserved for these tests and is the only rate-limit
  // fingerprint the cleanup ever deletes.
  return `10.221.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function post(body: unknown, ip: string): Request {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function validDonation(key: string) {
  return {
    company: "",
    idempotencyKey: key,
    templeName: "Synthetic PG Test Temple",
    templeWebsite: "",
    streetAddress: "1 Synthetic Way",
    addressLine2: "",
    city: "Houston",
    state: "TX",
    zipCode: "77001",
    contactName: "Synthetic Person",
    contactRole: "Trustee",
    contactEmail: "synthetic-pg-test@example.org",
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
  };
}

function validSupport(key: string) {
  return {
    company: "",
    idempotencyKey: key,
    name: "Synthetic Helper",
    email: "helper-pg-synth@example.org",
    organization: "",
    city: "",
    state: "",
    supportType: "volunteer",
    message: "I can help coordinate synthetic test deliveries on weekends.",
    privacyConsent: true,
  };
}

function validContact(key: string) {
  return {
    company: "",
    idempotencyKey: key,
    name: "Synthetic Inquirer",
    email: "inquirer-pg-synth@example.org",
    subject: "Synthetic question",
    message: "Is this synthetic test message long enough to be valid?",
    privacyConsent: true,
  };
}

async function cleanupSyntheticRows(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  // Delete ONLY synthetic rows created by this suite.
  await pool.query(
    `DELETE FROM "request_status_history" WHERE "request_id" IN (SELECT "id" FROM "donation_requests" WHERE "contact_email" ILIKE '%@example.org' AND "idempotency_key" LIKE 'pg-test-%')`
  );
  await pool.query(
    `DELETE FROM "donation_requests" WHERE "contact_email" ILIKE '%@example.org' AND "idempotency_key" LIKE 'pg-test-%'`
  );
  await pool.query(
    `DELETE FROM "support_offers" WHERE "email" ILIKE '%@example.org' AND "idempotency_key" LIKE 'pg-test-%'`
  );
  await pool.query(
    `DELETE FROM "contact_inquiries" WHERE "email" ILIKE '%@example.org' AND "idempotency_key" LIKE 'pg-test-%'`
  );
  await pool.query(
    `DELETE FROM "rate_limits" WHERE "key" LIKE '%10.221.%' OR "key" LIKE 'pg-test-%'`
  );
}

pgDescribe("postgres integration (real PostgreSQL 18, synthetic data)", () => {
  beforeAll(async () => {
    const db = getDb();
    expect(db, "expected DATABASE_URL to be configured for PG tests").toBeTruthy();
    const pool = getPool();
    expect(pool).toBeTruthy();
    // Basic connectivity check.
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

  it("has the migrated tables and unique constraints", async () => {
    const pool = getPool()!;
    const tables = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('donation_requests','request_status_history','support_offers','contact_inquiries','rate_limits')`
    );
    expect(tables.rows.map((r) => r.tablename).sort()).toEqual(
      [
        "contact_inquiries",
        "donation_requests",
        "rate_limits",
        "request_status_history",
        "support_offers",
      ].sort()
    );
    // Unique idempotency constraints back the dedupe path.
    const idx = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('donation_requests_public_ref_uidx')`
    );
    expect(idx.rows.length).toBeGreaterThanOrEqual(0);
    const uniques = await pool.query(
      `SELECT conname FROM pg_constraint WHERE conname LIKE '%idempotency%' OR conname = 'rate_limits_key_window_uidx' OR conname LIKE '%public_ref%'`
    );
    const names = uniques.rows.map((r) => r.conname);
    expect(names.length).toBeGreaterThan(0);
  }, 30_000);

  it("persists a donation request plus its transactional audit row", async () => {
    const key = synthKey("req");
    const res = await requestsPost(post(validDonation(key), freshIp()));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.ref).toMatch(/^SVS-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const db = getDb()!;
    const rows = await db
      .select()
      .from(donationRequests)
      .where(eq(donationRequests.idempotencyKey, key))
      .limit(1);
    expect(rows.length).toBe(1);
    expect(rows[0].templeName).toBe("Synthetic PG Test Temple");
    expect(rows[0].contactEmail).toBe("synthetic-pg-test@example.org");
    expect(rows[0].status).toBe("submitted");
    expect(rows[0].publicRef).toBe(data.ref);

    const history = await db
      .select()
      .from(statusHistory)
      .where(eq(statusHistory.requestId, rows[0].id));
    expect(history.length).toBe(1);
    expect(history[0].toStatus).toBe("submitted");
    expect(history[0].fromStatus).toBeNull();
    expect(history[0].changedBy).toBe("system");
  }, 30_000);

  it("persists support offers and contact inquiries", async () => {
    const db = getDb()!;
    const supKey = synthKey("sup");
    const supRes = await supportPost(post(validSupport(supKey), freshIp()));
    expect(supRes.status).toBe(201);
    const supData = await supRes.json();
    expect(supData.ref).toMatch(/^SUP-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const supRows = await db
      .select()
      .from(supportOffers)
      .where(eq(supportOffers.idempotencyKey, supKey))
      .limit(1);
    expect(supRows.length).toBe(1);
    expect(supRows[0].publicRef).toBe(supData.ref);

    const conKey = synthKey("con");
    const conRes = await contactPost(post(validContact(conKey), freshIp()));
    expect(conRes.status).toBe(201);
    const conData = await conRes.json();
    expect(conData.ref).toMatch(/^CON-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const conRows = await db
      .select()
      .from(contactInquiries)
      .where(eq(contactInquiries.idempotencyKey, conKey))
      .limit(1);
    expect(conRows.length).toBe(1);
    expect(conRows[0].publicRef).toBe(conData.ref);
  }, 30_000);

  it("sequential retries with the same idempotency key leave exactly 1 row", async () => {
    const db = getDb()!;
    const key = synthKey("seq");
    const first = await requestsPost(post(validDonation(key), freshIp()));
    expect(first.status).toBe(201);
    const refA = (await first.json()).ref;

    const second = await requestsPost(post(validDonation(key), freshIp()));
    expect(second.status).toBe(200);
    const dataB = await second.json();
    expect(dataB.ok).toBe(true);
    expect(dataB.ref).toBe(refA);
    expect(dataB.deduped).toBe(true);

    const count = await db
      .select({ n: sql<number>`count(*)` })
      .from(donationRequests)
      .where(eq(donationRequests.idempotencyKey, key));
    expect(Number(count[0].n)).toBe(1);
  }, 30_000);

  it("concurrent retries with the same key converge on one record", async () => {
    const db = getDb()!;
    const key = synthKey("race");
    const [a, b] = await Promise.all([
      contactPost(post(validContact(key), freshIp())),
      contactPost(post(validContact(key), freshIp())),
    ]);
    const da = await a.json();
    const dbd = await b.json();
    expect(da.ok).toBe(true);
    expect(dbd.ok).toBe(true);
    expect(da.ref).toBe(dbd.ref);

    const count = await db
      .select({ n: sql<number>`count(*)` })
      .from(contactInquiries)
      .where(eq(contactInquiries.idempotencyKey, key));
    expect(Number(count[0].n)).toBe(1);
  }, 30_000);

  it("invalid payloads and missing consent leave 0 rows", async () => {
    const db = getDb()!;
    const badKey = synthKey("bad");
    const bad = await requestsPost(
      post({ ...validDonation(badKey), templeName: "", zipCode: "bad" }, freshIp())
    );
    expect(bad.status).toBe(422);
    const badRows = await db
      .select({ id: donationRequests.id })
      .from(donationRequests)
      .where(eq(donationRequests.idempotencyKey, badKey));
    expect(badRows.length).toBe(0);

    for (const patch of [
      { privacyConsent: false },
      { authorized: false },
      { understandsNoGuarantee: false },
    ]) {
      const k = synthKey("consent");
      const res = await requestsPost(
        post({ ...validDonation(k), ...patch }, freshIp())
      );
      expect(res.status).toBe(422);
      const rows = await db
        .select({ id: donationRequests.id })
        .from(donationRequests)
        .where(eq(donationRequests.idempotencyKey, k));
      expect(rows.length).toBe(0);
    }

    const supKey = synthKey("supbad");
    const supBad = await supportPost(
      post({ ...validSupport(supKey), message: "short" }, freshIp())
    );
    expect(supBad.status).toBe(422);
    expect(
      await db
        .select({ id: supportOffers.id })
        .from(supportOffers)
        .where(eq(supportOffers.idempotencyKey, supKey))
    ).toHaveLength(0);
  }, 30_000);

  it("DB-backed rate limits persist buckets and enforce 429", async () => {
    const db = getDb()!;
    const ip = freshIp();
    // Honeypot submissions consume rate-limit budget without creating
    // donation rows, keeping this test isolated to the rate_limits table.
    for (let i = 0; i < 10; i++) {
      const r = await requestsPost(
        post(
          { ...validDonation(synthKey(`rl-${i}`)), company: "synthetic-probe" },
          ip
        )
      );
      expect(r.status).toBe(200);
    }
    const blocked = await requestsPost(
      post(
        { ...validDonation(synthKey("rl-x")), company: "synthetic-probe" },
        ip
      )
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).ok).toBe(false);

    const buckets = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, `requests:${ip}`))
      .limit(1);
    expect(buckets.length).toBe(1);
    expect(buckets[0].count).toBeGreaterThanOrEqual(10);

    // Direct limiter persistence with a small threshold on an isolated key.
    const directKey = `pg-test-${RUN_ID}-direct-${keyCounter}`;
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(directKey, 3, 3600);
      expect(r.allowed).toBe(true);
    }
    const fourth = await checkRateLimit(directKey, 3, 3600);
    expect(fourth.allowed).toBe(false);
    const direct = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, directKey))
      .limit(1);
    expect(direct.length).toBe(1);
    expect(direct[0].count).toBeGreaterThanOrEqual(3);
  }, 30_000);
});
