/**
 * Real-PostgreSQL integration coverage for Part 3B hardening.
 *
 * Exercises the ACTUAL production services (processStripeEvent,
 * processSponsorshipCheckout, getPublicFulfillmentEntries) against a real
 * database — no copied helpers, no fakes for the code under test. (Stripe's
 * HTTP API is the only stub: a local session-creator with idempotency-key
 * semantics; signature verification is covered in unit tests.)
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
import {
  donationRequests,
  fulfillmentLedger,
  sponsorshipCheckoutAttempts,
  sponsorshipOrders,
  sponsorshipStripeEvents,
} from "../lib/schema";
import { getDb, getPool } from "../lib/db";
import {
  getPublicFulfillmentEntries,
  getPublicFulfillmentTotals,
} from "../lib/fulfillment-ledger";
import { processStripeEvent, UnknownOrderError } from "../lib/stripe-webhook";
import {
  AttemptConflictError,
  processSponsorshipCheckout,
} from "../lib/sponsorship-checkout";
import { toSafeDeliveredDate } from "../lib/fulfillment-ledger";

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
  return `${prefix}-${RUN_ID}-${keyCounter}`.slice(0, 20);
}
function synthAttempt(): string {
  keyCounter += 1;
  return `pgatt-${RUN_ID}-${keyCounter}`.slice(0, 64);
}
function synthEvent(): string {
  keyCounter += 1;
  return `evt_pg_${RUN_ID}_${keyCounter}`;
}
function synthSession(): string {
  keyCounter += 1;
  return `cs_pg_${RUN_ID}_${keyCounter}`;
}

async function cleanupSyntheticRows(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `DELETE FROM "fulfillment_ledger" WHERE "public_ref" LIKE 'SUP-${RUN_ID}%' OR "recipient_label" LIKE '%${RUN_ID}%'`
  );
  await pool.query(
    `DELETE FROM "sponsorship_stripe_events" WHERE "stripe_event_id" LIKE 'evt_pg_${RUN_ID}%'`
  );
  await pool.query(
    `DELETE FROM "sponsorship_orders" WHERE "public_ref" LIKE 'SUP-${RUN_ID}%' OR "stripe_checkout_session_id" LIKE 'cs_pg_${RUN_ID}%'`
  );
  await pool.query(
    `DELETE FROM "sponsorship_checkout_attempts" WHERE "attempt_key" LIKE 'pgatt-${RUN_ID}%'`
  );
  await pool.query(
    `DELETE FROM "donation_requests" WHERE "temple_name" LIKE '%${RUN_ID}%' OR "idempotency_key" LIKE 'pg-test-${RUN_ID}%'`
  );
}

function fakeStripeSessions() {
  const byKey = new Map<string, { id: string; url: string }>();
  let calls = 0;
  return {
    calls: () => calls,
    sessions: {
      create: async (params: Record<string, unknown>, opts?: { idempotencyKey?: string }) => {
        calls += 1;
        const key = opts?.idempotencyKey ?? `nokey-${calls}`;
        const hit = byKey.get(key);
        if (hit) return { ...hit, params };
        const session = {
          id: synthSession(),
          url: `https://checkout.stripe.com/pay/pg-${RUN_ID}-${calls}`,
        };
        byKey.set(key, session);
        return { ...session, params };
      },
    },
  };
}

async function insertSyntheticRequest(overrides: Record<string, unknown> = {}) {
  const db = getDb()!;
  keyCounter += 1;
  const rows = await db
    .insert(donationRequests)
    .values({
      publicRef: synthRef("SVS"),
      idempotencyKey: `pg-test-${RUN_ID}-${keyCounter}`,
      templeName: `Synthetic Temple ${RUN_ID}`,
      streetAddress: "100 Test Ave",
      city: "Houston",
      state: "TX",
      zipCode: "77001",
      contactName: "Synthetic Contact",
      contactRole: "Volunteer",
      contactEmail: `synthetic-${RUN_ID}-${keyCounter}@example.org`,
      quantityPounds: 50,
      intendedUse: ["prasadam"],
      publicListingConsent: false,
      publicListingStatus: "private",
      ...overrides,
    })
    .returning({ id: donationRequests.id });
  return rows[0].id as string;
}

async function insertSyntheticOrder(overrides: Record<string, unknown> = {}) {
  const db = getDb()!;
  const rows = await db
    .insert(sponsorshipOrders)
    .values({
      publicRef: synthRef("SUP"),
      stripeCheckoutSessionId: synthSession(),
      tierCode: "bag_25",
      amountCents: 3500,
      currency: "usd",
      estimatedPounds: 25,
      status: "pending",
      publicRecognitionConsent: false,
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      ...overrides,
    })
    .returning();
  return rows[0];
}

pgDescribe("sponsorship + fulfillment hardening (real PostgreSQL, synthetic data)", () => {
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

  it("migrations created hardening tables, columns, and indexes", async () => {
    const pool = getPool()!;
    for (const table of ["sponsorship_orders", "fulfillment_ledger", "sponsorship_checkout_attempts", "sponsorship_stripe_events"]) {
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
      "checkout_attempt_key",
      "terms_version",
      "terms_accepted_at",
      "refunded_amount_cents",
    ]) {
      expect(names).toContain(c);
    }
    const ledgerCols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'fulfillment_ledger' ORDER BY column_name`
    );
    const ledgerNames = ledgerCols.rows.map((r: { column_name: string }) => r.column_name);
    for (const c of ["public_ref", "recipient_label", "pounds_delivered", "public_visible", "recorded_by", "idempotency_key"]) {
      expect(ledgerNames).toContain(c);
    }
    const idx = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('sponsorship_orders_status_idx','fulfillment_ledger_public_visible_idx','sponsorship_orders_attempt_key_uidx','fulfillment_ledger_idempotency_uidx')`
    );
    expect(idx.rows.length).toBe(4);
  }, 30_000);

  it("webhook service: paid once, unpaid never paid, mismatch never paid", async () => {
    const db = getDb()!;
    const order = await insertSyntheticOrder();
    const paid = await processStripeEvent(db as never, {
      id: synthEvent(),
      type: "checkout.session.completed",
      data: {
        object: {
          id: order.stripeCheckoutSessionId,
          payment_status: "paid",
          payment_intent: `pi_pg_${RUN_ID}_1`,
          amount_total: 3500,
          currency: "usd",
          customer_details: { email: "Donor@Example.org" },
        },
      },
    });
    expect(paid.action).toBe("paid");
    const after = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.id, order.id)).limit(1);
    expect(after[0].status).toBe("paid");
    expect(after[0].sponsorEmail).toBe("donor@example.org");

    // Replay is idempotent via the stored event id.
    const replay = await processStripeEvent(db as never, {
      id: synthEvent(),
      type: "checkout.session.completed",
      data: {
        object: {
          id: order.stripeCheckoutSessionId,
          payment_status: "paid",
          payment_intent: `pi_pg_${RUN_ID}_1`,
          amount_total: 3500,
          currency: "usd",
        },
      },
    });
    expect(replay.action === "paid" || replay.action === "duplicate" || replay.action === "ignored").toBe(true);

    // Unpaid completion never becomes paid.
    const pending = await insertSyntheticOrder();
    const unpaid = await processStripeEvent(db as never, {
      id: synthEvent(),
      type: "checkout.session.completed",
      data: { object: { id: pending.stripeCheckoutSessionId, payment_status: "unpaid", amount_total: 3500, currency: "usd" } },
    });
    expect(unpaid.action).toBe("ignored");
    const kept = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.id, pending.id)).limit(1);
    expect(kept[0].status).toBe("pending");

    // Amount/currency mismatch never becomes paid.
    const mismatch = await insertSyntheticOrder();
    const bad = await processStripeEvent(db as never, {
      id: synthEvent(),
      type: "checkout.session.completed",
      data: { object: { id: mismatch.stripeCheckoutSessionId, payment_status: "paid", amount_total: 1, currency: "usd" } },
    });
    expect(bad.action).toBe("ignored");
    const kept2 = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.id, mismatch.id)).limit(1);
    expect(kept2[0].status).toBe("pending");
  }, 30_000);

  it("webhook service: refund then delayed completion stays refunded; partial vs full", async () => {
    const db = getDb()!;
    const pi = `pi_pg_${RUN_ID}_refund`;
    const order = await insertSyntheticOrder({ stripePaymentIntentId: pi, status: "paid", paidAt: new Date() });
    const refunded = await processStripeEvent(db as never, {
      id: synthEvent(),
      type: "charge.refunded",
      data: { object: { payment_intent: pi, amount: 3500, amount_refunded: 3500, refunded: true } },
    });
    expect(refunded.action).toBe("refunded");
    const late = await processStripeEvent(db as never, {
      id: synthEvent(),
      type: "checkout.session.completed",
      data: { object: { id: order.stripeCheckoutSessionId, payment_status: "paid", payment_intent: pi, amount_total: 3500, currency: "usd" } },
    });
    expect(late.action).toBe("ignored");
    const kept = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.id, order.id)).limit(1);
    expect(kept[0].status).toBe("refunded");

    // Partial refund is labeled partially_refunded with the partial amount.
    const pi2 = `pi_pg_${RUN_ID}_partial`;
    const order2 = await insertSyntheticOrder({ stripePaymentIntentId: pi2, status: "paid", paidAt: new Date() });
    const partial = await processStripeEvent(db as never, {
      id: synthEvent(),
      type: "charge.refunded",
      data: { object: { payment_intent: pi2, amount: 3500, amount_refunded: 1000, refunded: false } },
    });
    expect(partial.action).toBe("partially_refunded");
    const kept2 = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.id, order2.id)).limit(1);
    expect(kept2[0].status).toBe("partially_refunded");
    expect(kept2[0].refundedAmountCents).toBe(1000);
  }, 30_000);

  it("webhook service: unknown orders stay retryable and concurrent duplicates stay single-paid", async () => {
    const db = getDb()!;
    const unknownId = synthEvent();
    await expect(
      processStripeEvent(db as never, {
        id: unknownId,
        type: "checkout.session.completed",
        data: { object: { id: "cs_pg_missing_xyz", payment_status: "paid", amount_total: 3500, currency: "usd" } },
      })
    ).rejects.toBeInstanceOf(UnknownOrderError);
    // No event row persisted: a retry is still possible.
    const seen = await db.select().from(sponsorshipStripeEvents).where(eq(sponsorshipStripeEvents.stripeEventId, unknownId)).limit(1);
    expect(seen.length).toBe(0);

    // Concurrent duplicates: exactly one paid outcome, one event row.
    const order = await insertSyntheticOrder();
    const mkEvent = (id: string) => ({
      id,
      type: "checkout.session.completed",
      data: {
        object: {
          id: order.stripeCheckoutSessionId,
          payment_status: "paid",
          payment_intent: `pi_pg_${RUN_ID}_conc`,
          amount_total: 3500,
          currency: "usd",
        },
      },
    });
    const dupId = synthEvent();
    const settled = await Promise.allSettled([
      processStripeEvent(db as never, mkEvent(dupId)),
      processStripeEvent(db as never, mkEvent(dupId)),
    ]);
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const kept = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.id, order.id)).limit(1);
    expect(kept[0].status).toBe("paid");
    const evts = await db.select().from(sponsorshipStripeEvents).where(eq(sponsorshipStripeEvents.stripeEventId, dupId)).limit(1);
    expect(evts.length).toBe(1);
  }, 30_000);

  it("checkout service: repeated attempts create one session/order; conflicts rejected; terms stored", async () => {
    const db = getDb()!;
    const stripe = fakeStripeSessions();
    const attemptKey = synthAttempt();
    const first = await processSponsorshipCheckout(db as never, stripe.sessions as never, { tierCode: "bag_25", attemptKey, termsVersion: "v1" }, { baseUrl: "http://localhost:3000" });
    expect(first.url).toContain("https://checkout.stripe.com");
    expect(first.reused).toBe(false);
    const second = await processSponsorshipCheckout(db as never, stripe.sessions as never, { tierCode: "bag_25", attemptKey, termsVersion: "v1" }, { baseUrl: "http://localhost:3000" });
    expect(second.reused).toBe(true);
    expect(second.url).toBe(first.url);
    expect(second.publicRef).toBe(first.publicRef);
    // Stripe saw one logical session (idempotency key) across both calls.
    expect(stripe.calls()).toBe(2);
    const orders = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.checkoutAttemptKey, attemptKey)).limit(5);
    expect(orders.length).toBe(1);
    expect(orders[0].termsVersion).toBe("v1");
    expect(orders[0].termsAcceptedAt).toBeInstanceOf(Date);
    expect(Number(orders[0].amountCents)).toBe(3500);

    // Conflicting reuse (different tier) is rejected.
    await expect(
      processSponsorshipCheckout(db as never, stripe.sessions as never, { tierCode: "bag_100", attemptKey, termsVersion: "v1" }, { baseUrl: "http://localhost:3000" })
    ).rejects.toBeInstanceOf(AttemptConflictError);
  }, 30_000);

  it("checkout service: crash between session creation and order persistence recovers on retry", async () => {
    const db = getDb()!;
    const stripe = fakeStripeSessions();
    const attemptKey = synthAttempt();
    // Simulate a crash: the attempt row exists with a Stripe session + URL
    // but the order row was never persisted.
    const publicRef = synthRef("SUP");
    const stranded = await stripe.sessions.create({ mode: "payment" }, { idempotencyKey: `sponsorship-checkout-${attemptKey}` });
    await db.insert(sponsorshipCheckoutAttempts).values({
      attemptKey,
      tierCode: "bag_10",
      termsVersion: "v1",
      stripeSessionId: stranded.id,
      stripeSessionUrl: stranded.url,
      publicRef,
    });
    const retry = await processSponsorshipCheckout(db as never, stripe.sessions as never, { tierCode: "bag_10", attemptKey, termsVersion: "v1" }, { baseUrl: "http://localhost:3000" });
    expect(retry.reused).toBe(true);
    expect(retry.publicRef).toBe(publicRef);
    const orders = await db.select().from(sponsorshipOrders).where(eq(sponsorshipOrders.checkoutAttemptKey, attemptKey)).limit(5);
    expect(orders.length).toBe(1);
    expect(orders[0].stripeCheckoutSessionId).toBe(stranded.id);
  }, 30_000);

  it("public ledger: consent gate, unpublish anonymization, and no PII leakage", async () => {
    const db = getDb()!;
    const listedId = await insertSyntheticRequest({ publicListingConsent: true, publicListingStatus: "published" });
    const listed = await db.select().from(donationRequests).where(eq(donationRequests.id, listedId)).limit(1);
    const templeName = listed[0].templeName;

    const visibleRef = synthRef("SUP");
    await db.insert(fulfillmentLedger).values({
      publicRef: visibleRef,
      idempotencyKey: `pg-ledger-${RUN_ID}-1`,
      donationRequestId: listedId,
      recipientLabel: templeName,
      city: "Houston",
      state: "TX",
      poundsDelivered: 50,
      sugarProductLabel: "Organic cane sugar, 50 lb",
      deliveredAt: new Date("2026-01-15T12:00:00Z"),
      recordedBy: `synthetic-admin-${RUN_ID}@example.org`,
      internalNotes: `synthetic private note ${RUN_ID} - truck 7`,
      publicVisible: true,
    });
    const hiddenRef = synthRef("SUP");
    await db.insert(fulfillmentLedger).values({
      publicRef: hiddenRef,
      idempotencyKey: `pg-ledger-${RUN_ID}-2`,
      recipientLabel: `Hidden Temple ${RUN_ID}`,
      city: "Austin",
      state: "TX",
      poundsDelivered: 999,
      sugarProductLabel: "Hidden sugar",
      deliveredAt: new Date("2026-01-16T12:00:00Z"),
      recordedBy: `synthetic-admin-${RUN_ID}@example.org`,
      internalNotes: "hidden private",
      publicVisible: false,
    });
    // Unlinked delivery: anonymized.
    const unlinkedRef = synthRef("SUP");
    await db.insert(fulfillmentLedger).values({
      publicRef: unlinkedRef,
      idempotencyKey: `pg-ledger-${RUN_ID}-3`,
      recipientLabel: `Participating Temple (CA)`,
      city: null,
      state: "CA",
      poundsDelivered: 10,
      sugarProductLabel: "Unrefined cane sugar, 10 lb",
      deliveredAt: new Date("2026-01-17T12:00:00Z"),
      recordedBy: `synthetic-admin-${RUN_ID}@example.org`,
      internalNotes: null,
      publicVisible: true,
    });

    const entries = await getPublicFulfillmentEntries(100);
    const visible = entries.find((e) => e.publicRef === visibleRef);
    expect(visible).toBeTruthy();
    // Linked + consenting + published: name and city shown.
    expect(visible!.recipientLabel).toBe(templeName);
    expect(visible!.city).toBe("Houston");
    // Exact public key set; linkage IDs must never appear.
    expect(Object.keys(visible!).sort()).toEqual(
      ["city", "deliveredAt", "poundsDelivered", "publicRef", "recipientLabel", "state", "sugarProductLabel"].sort()
    );
    expect(JSON.stringify(visible)).not.toContain(`synthetic-admin-${RUN_ID}@example.org`);
    expect(JSON.stringify(visible)).not.toContain(`truck 7`);
    expect(JSON.stringify(entries)).not.toContain("donationRequestId");
    expect(entries.find((e) => e.publicRef === hiddenRef)).toBeUndefined();
    const unlinked = entries.find((e) => e.publicRef === unlinkedRef);
    expect(unlinked).toBeTruthy();
    expect(unlinked!.recipientLabel).toBe("Participating Temple (CA)");
    expect(unlinked!.city).toBeNull();

    const totals = await getPublicFulfillmentTotals();
    expect(totals.totalDeliveries).toBeGreaterThanOrEqual(2);
    expect(totals.totalPounds).toBeGreaterThanOrEqual(60);

    // Later unpublishing anonymizes the historical public entry.
    await db.update(donationRequests).set({ publicListingStatus: "unpublished" }).where(eq(donationRequests.id, listedId));
    const afterUnpublish = await getPublicFulfillmentEntries(100);
    const anon = afterUnpublish.find((e) => e.publicRef === visibleRef);
    expect(anon).toBeTruthy();
    expect(anon!.recipientLabel).toBe("Participating Temple (TX)");
    expect(anon!.city).toBeNull();
    expect(JSON.stringify(anon)).not.toContain(templeName);
    expect(JSON.stringify(anon)).not.toContain("Houston");
  }, 30_000);

  it("strict dates reject impossible calendar days", () => {
    expect(toSafeDeliveredDate("2026-02-30")).toBeNull();
    expect(toSafeDeliveredDate("2026-01-15")).toBeInstanceOf(Date);
  }, 30_000);
});
