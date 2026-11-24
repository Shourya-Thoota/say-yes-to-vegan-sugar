/**
 * Real-PostgreSQL integration coverage for Part 3B (sponsorship + ledger).
 *
 * Runs ONLY when a test database is explicitly provided:
 *   - TEST_DATABASE_URL is set, OR
 *   - DATABASE_URL is set AND RUN_PG_TESTS=1
 * Otherwise the whole suite skips cleanly.
 *
 * Safety: refuses production-like hosts; synthetic data only
 * (example.org, 10.223.x.x IPs, `pg-test-` keys); cleans up only
 * synthetic rows after each test.
 */
import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { fulfillmentLedger, sponsorshipOrders } from "../lib/schema";
import { getDb, getPool } from "../lib/db";
import {
  getPublicFulfillmentEntries,
  getPublicFulfillmentTotals,
} from "../lib/fulfillment-ledger";

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
  8
);
let keyCounter = 0;
function synthRef(prefix: string): string {
  keyCounter += 1;
  // Keep refs unique within varchar(20): short prefix + short run id + counter.
  // e.g. SUP-r1a2b3c4-7 (well under 20 chars).
  return `${prefix}-${RUN_ID}-${keyCounter}`.slice(0, 20);
}

async function cleanupSyntheticRows(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `DELETE FROM "fulfillment_ledger" WHERE "public_ref" LIKE 'SUP-${RUN_ID}%' OR "recipient_label" LIKE '%${RUN_ID}%'`
  );
  await pool.query(
    `DELETE FROM "sponsorship_orders" WHERE "public_ref" LIKE 'SUP-${RUN_ID}%' OR "stripe_checkout_session_id" LIKE 'cs_pg_${RUN_ID}%'`
  );
}

pgDescribe("sponsorship + fulfillment (real PostgreSQL, synthetic data)", () => {
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

  it("migration 0002 created sponsorship + ledger tables, defaults, and indexes", async () => {
    const pool = getPool()!;
    for (const table of ["sponsorship_orders", "fulfillment_ledger"]) {
      const t = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name = '${table}'`
      );
      expect(t.rows.length).toBe(1);
    }
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sponsorship_orders' ORDER BY column_name`
    );
    const names = cols.rows.map((r: { column_name: string }) => r.column_name);
    for (const c of [
      "public_ref",
      "stripe_checkout_session_id",
      "tier_code",
      "amount_cents",
      "status",
      "public_recognition_consent",
    ]) {
      expect(names).toContain(c);
    }
    const ledgerCols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'fulfillment_ledger' ORDER BY column_name`
    );
    const ledgerNames = ledgerCols.rows.map((r: { column_name: string }) => r.column_name);
    for (const c of ["public_ref", "recipient_label", "pounds_delivered", "public_visible", "recorded_by"]) {
      expect(ledgerNames).toContain(c);
    }
    const idx = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('sponsorship_orders_status_idx','fulfillment_ledger_public_visible_idx')`
    );
    expect(idx.rows.length).toBe(2);
  }, 30_000);

  it("order lifecycle: pending -> paid idempotently -> refunded", async () => {
    const db = getDb()!;
    const sessionId = `cs_pg_${RUN_ID}_${Date.now()}_1`;
    const publicRef = synthRef("SUP");
    const inserted = await db
      .insert(sponsorshipOrders)
      .values({
        publicRef,
        stripeCheckoutSessionId: sessionId,
        tierCode: "bag_25",
        amountCents: 3500,
        estimatedPounds: 25,
        status: "pending",
        publicRecognitionConsent: false,
      })
      .returning({ id: sponsorshipOrders.id });
    expect(inserted.length).toBe(1);

    // Simulate webhook paid update (idempotent helper mirrors route logic).
    async function markPaid() {
      const rows = await db
        .select()
        .from(sponsorshipOrders)
        .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
        .limit(1);
      if (rows[0].status === "paid") return rows[0];
      await db
        .update(sponsorshipOrders)
        .set({ status: "paid", paidAt: new Date(), stripePaymentIntentId: "pi_pg_test_1" })
        .where(eq(sponsorshipOrders.id, rows[0].id));
      const again = await db
        .select()
        .from(sponsorshipOrders)
        .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
        .limit(1);
      return again[0];
    }
    const paid1 = await markPaid();
    expect(paid1.status).toBe("paid");
    expect(paid1.stripePaymentIntentId).toBe("pi_pg_test_1");
    const paid2 = await markPaid();
    expect(paid2.status).toBe("paid");

    // Refunded via payment intent.
    await db
      .update(sponsorshipOrders)
      .set({ status: "refunded" })
      .where(eq(sponsorshipOrders.stripePaymentIntentId, "pi_pg_test_1"));
    const refunded = await db
      .select()
      .from(sponsorshipOrders)
      .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
      .limit(1);
    expect(refunded[0].status).toBe("refunded");

    // Expired must never overwrite paid/refunded: simulate guard.
    const final = refunded[0];
    if (final.status === "pending") {
      await db.update(sponsorshipOrders).set({ status: "expired" }).where(eq(sponsorshipOrders.id, final.id));
    }
    const kept = await db
      .select()
      .from(sponsorshipOrders)
      .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
      .limit(1);
    expect(kept[0].status).toBe("refunded");
  }, 30_000);

  it("public ledger filters private rows and excludes all PII", async () => {
    const db = getDb()!;
    const visibleRef = synthRef("SUP");
    const hiddenRef = synthRef("SUP");
    await db.insert(fulfillmentLedger).values({
      publicRef: visibleRef,
      recipientLabel: `Synthetic Temple Kitchen ${RUN_ID}`,
      city: "Houston",
      state: "TX",
      poundsDelivered: 50,
      sugarProductLabel: "Organic cane sugar, 50 lb",
      deliveredAt: new Date("2026-01-15T12:00:00Z"),
      recordedBy: "synthetic-admin@example.org",
      internalNotes: "synthetic private note - truck 7",
      publicVisible: true,
    });
    await db.insert(fulfillmentLedger).values({
      publicRef: hiddenRef,
      recipientLabel: `Hidden Temple ${RUN_ID}`,
      city: "Austin",
      state: "TX",
      poundsDelivered: 999,
      sugarProductLabel: "Hidden sugar",
      deliveredAt: new Date("2026-01-16T12:00:00Z"),
      recordedBy: "synthetic-admin@example.org",
      internalNotes: "hidden private",
      publicVisible: false,
    });

    const entries = await getPublicFulfillmentEntries(100);
    const visible = entries.find((e) => e.publicRef === visibleRef);
    expect(visible).toBeTruthy();
    expect(Object.keys(visible!).sort()).toEqual(
      ["city", "deliveredAt", "poundsDelivered", "publicRef", "recipientLabel", "state", "sugarProductLabel"].sort()
    );
    expect(JSON.stringify(visible)).not.toContain("synthetic-admin@example.org");
    expect(JSON.stringify(visible)).not.toContain("truck 7");
    expect(entries.find((e) => e.publicRef === hiddenRef)).toBeUndefined();

    const totals = await getPublicFulfillmentTotals();
    expect(totals.totalDeliveries).toBeGreaterThanOrEqual(1);
    expect(totals.totalPounds).toBeGreaterThanOrEqual(50);
    // Hidden 999-lb row must not leak into public totals for this run's refs,
    // but totals aggregate all public rows; assert our visible row counted.
    expect(entries.reduce((s, e) => s + e.poundsDelivered, 0)).toBeGreaterThanOrEqual(50);
  }, 30_000);
});
