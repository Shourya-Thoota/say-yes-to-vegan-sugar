/**
 * Part 3B hardening unit coverage. Exercises the ACTUAL production webhook
 * route + shared checkout/webhook services (not copied helpers), the real
 * validation schemas, and the real privacy-gating projection.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  donationRequests,
  fulfillmentLedger,
  sponsorshipCheckoutAttempts,
  sponsorshipOrders,
  sponsorshipStripeEvents,
} from "../lib/schema";

// ---------------------------------------------------------------------------
// Faithful in-memory DB: evaluates eq/and/inArray conditions by column
// identity so tests exercise real query shapes (conditional updates,
// idempotency lookups). Unique constraints throw like Postgres.
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  attempts: new Map<string, Record<string, unknown>>(),
  orders: new Map<string, Record<string, unknown>>(),
  ordersBySession: new Map<string, string>(),
  ordersByAttempt: new Map<string, string>(),
  ordersByIntent: new Map<string, string>(),
  ordersByRef: new Map<string, string>(),
  events: new Map<string, Record<string, unknown>>(),
  ledger: [] as Record<string, unknown>[],
  ledgerByKey: new Map<string, Record<string, unknown>>(),
  requests: new Map<string, Record<string, unknown>>(),
  buckets: [] as { key: string; windowStart: Date; count: number }[],
  stripeSessionCounter: 0,
  stripeByIdem: new Map<string, { id: string; url: string }>(),
  idemKeysSeen: [] as (string | undefined)[],
  failNextOrderInsert: false,
  idCounter: 0,
}));

function nextId(prefix: string): string {
  state.idCounter += 1;
  return `${prefix}-${state.idCounter}-${Date.now().toString(36)}`;
}

type Cond =
  | { __testEq: true; column: unknown; value: unknown }
  | { __testAnd: true; conds: Cond[] }
  | { __testInArray: true; column: unknown; values: unknown[] }
  | { __testGte: true; column: unknown; value: unknown }
  | null
  | undefined;

function fieldOf(column: unknown): { table: string; field: string } | null {
  const so = sponsorshipOrders as unknown as Record<string, unknown>;
  const at = sponsorshipCheckoutAttempts as unknown as Record<string, unknown>;
  const ev = sponsorshipStripeEvents as unknown as Record<string, unknown>;
  const fl = fulfillmentLedger as unknown as Record<string, unknown>;
  const dr = donationRequests as unknown as Record<string, unknown>;
  if (column === so.id) return { table: "orders", field: "id" };
  if (column === so.publicRef) return { table: "orders", field: "publicRef" };
  if (column === so.stripeCheckoutSessionId) return { table: "orders", field: "stripeCheckoutSessionId" };
  if (column === so.stripePaymentIntentId) return { table: "orders", field: "stripePaymentIntentId" };
  if (column === so.status) return { table: "orders", field: "status" };
  if (column === so.checkoutAttemptKey) return { table: "orders", field: "checkoutAttemptKey" };
  if (column === at.attemptKey) return { table: "attempts", field: "attemptKey" };
  if (column === at.stripeSessionId) return { table: "attempts", field: "stripeSessionId" };
  if (column === ev.stripeEventId) return { table: "events", field: "stripeEventId" };
  if (column === fl.id) return { table: "ledger", field: "id" };
  if (column === fl.idempotencyKey) return { table: "ledger", field: "idempotencyKey" };
  if (column === dr.id) return { table: "requests", field: "id" };
  return null;
}

function matches(row: Record<string, unknown>, cond: Cond): boolean {
  if (!cond) return true;
  const c = cond as Record<string, unknown>;
  if (c.__testEq === true) {
    const f = fieldOf(c.column);
    if (!f) return true; // unknown column (e.g. rate_limits): do not filter
    return row[f.field] === (cond as { value: unknown }).value;
  }
  if (c.__testAnd === true) {
    return ((cond as { conds: Cond[] }).conds ?? []).every((x) => matches(row, x));
  }
  if (c.__testInArray === true) {
    const f = fieldOf(c.column);
    if (!f) return true;
    const vals = (cond as { values: unknown[] }).values ?? [];
    return vals.includes(row[f.field]);
  }
  if (c.__testGte === true) return true;
  return true;
}

function allRows(table: unknown): Record<string, unknown>[] {
  if (table === sponsorshipOrders) return [...state.orders.values()];
  if (table === sponsorshipCheckoutAttempts) return [...state.attempts.values()];
  if (table === sponsorshipStripeEvents) return [...state.events.values()];
  if (table === fulfillmentLedger) return state.ledger;
  if (table === donationRequests) return [...state.requests.values()];
  return [];
}

function insertRow(table: unknown, data: Record<string, unknown>): unknown {
  if (table === sponsorshipCheckoutAttempts) {
    const key = String(data.attemptKey ?? "");
    if (state.attempts.has(key)) throw new Error('duplicate key value violates unique constraint "sponsorship_attempts_key_uidx"');
    if (data.stripeSessionId && [...state.attempts.values()].some((r) => r.stripeSessionId === data.stripeSessionId)) {
      throw new Error('duplicate key value violates unique constraint "sponsorship_checkout_attempts_stripe_session_id_key"');
    }
    const row = { id: nextId("att"), createdAt: new Date(), updatedAt: new Date(), ...data };
    state.attempts.set(key, row);
    return [row];
  }
  if (table === sponsorshipOrders) {
    if (state.failNextOrderInsert) {
      state.failNextOrderInsert = false;
      throw new Error("simulated persistence failure");
    }
    const ref = String(data.publicRef ?? "");
    const sess = String(data.stripeCheckoutSessionId ?? "");
    const att = data.checkoutAttemptKey != null ? String(data.checkoutAttemptKey) : null;
    if (ref && state.ordersByRef.has(ref)) throw new Error('duplicate key value violates unique constraint "sponsorship_orders_public_ref_uidx"');
    if (sess && state.ordersBySession.has(sess)) throw new Error('duplicate key value violates unique constraint "sponsorship_orders_stripe_checkout_session_id_key"');
    if (att && state.ordersByAttempt.has(att)) throw new Error('duplicate key value violates unique constraint "sponsorship_orders_attempt_key_uidx"');
    const id = nextId("so");
    const row = { createdAt: new Date(), updatedAt: new Date(), paidAt: null, ...data, id };
    state.orders.set(id, row);
    if (ref) state.ordersByRef.set(ref, id);
    if (sess) state.ordersBySession.set(sess, id);
    if (att) state.ordersByAttempt.set(att, id);
    if (data.stripePaymentIntentId) state.ordersByIntent.set(String(data.stripePaymentIntentId), id);
    return [row];
  }
  if (table === sponsorshipStripeEvents) {
    const eid = String(data.stripeEventId ?? "");
    if (state.events.has(eid)) throw new Error('duplicate key value violates unique constraint "sponsorship_stripe_events_id_uidx"');
    const row = { id: nextId("evt"), createdAt: new Date(), ...data };
    state.events.set(eid, row);
    return [row];
  }
  if (table === fulfillmentLedger) {
    const key = data.idempotencyKey != null ? String(data.idempotencyKey) : null;
    if (key && state.ledgerByKey.has(key)) throw new Error('duplicate key value violates unique constraint "fulfillment_ledger_idempotency_uidx"');
    const row = { id: nextId("fl"), createdAt: new Date(), ...data };
    state.ledger.push(row);
    if (key) state.ledgerByKey.set(key, row);
    return [row];
  }
  if (table === donationRequests) {
    const id = (data.id as string | undefined) ?? nextId("req");
    const row = { id, ...data };
    state.requests.set(id, row);
    return [row];
  }
  state.buckets.push({
    key: String(data.key),
    windowStart: data.windowStart instanceof Date ? data.windowStart : new Date(String(data.windowStart)),
    count: Number(data.count ?? 1),
  });
  return [];
}

function applyUpdate(table: unknown, data: Record<string, unknown>, cond: Cond): Record<string, unknown>[] {
  const rows = allRows(table).filter((r) => matches(r, cond));
  for (const r of rows) {
    Object.assign(r, data);
    if (table === sponsorshipOrders) {
      if (data.stripePaymentIntentId && typeof data.stripePaymentIntentId === "string") {
        state.ordersByIntent.set(data.stripePaymentIntentId, String(r.id));
      }
      if (data.checkoutAttemptKey && typeof data.checkoutAttemptKey === "string") {
        state.ordersByAttempt.set(data.checkoutAttemptKey, String(r.id));
      }
    }
  }
  return rows;
}

const fakeDb: {
  select: (fields?: unknown) => {
    from: (table: unknown) => {
      where: (cond: unknown) => {
        limit: (n: number) => Promise<Record<string, unknown>[]>;
        then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
      };
      orderBy: (...a: unknown[]) => { limit: (n: number) => Promise<Record<string, unknown>[]> };
    } & {
      orderBy: (...a: unknown[]) => { limit: (n: number) => Promise<Record<string, unknown>[]> };
    };
    // join support omitted: unit tests cover the pure gate (toPublicEntry);
    // the joined read path is covered against real PostgreSQL.
  };
  insert: (table: unknown) => {
    values: (data: Record<string, unknown>) => {
      then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
      returning: (fields?: unknown) => Promise<unknown>;
    };
  };
  update: (table: unknown) => {
    set: (data: Record<string, unknown>) => {
      where: (cond: unknown) => {
        then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
        returning: (fields?: unknown) => Promise<Record<string, unknown>[]>;
      };
    };
  };
  transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
} = {
  select: (_fields?: unknown) => ({
    from: (table: unknown) => {
      const base = {
        where: (cond: unknown) => {
          const run = async () => allRows(table).filter((r) => matches(r, cond as Cond));
          const whereObj = {
            limit: (_n: number) => run(),
            then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(run()).then(resolve, reject),
          };
          return whereObj;
        },
        orderBy: (..._a: unknown[]) => ({
          limit: async () => allRows(table),
        }),
      };
      return base as never;
    },
  }),
  insert: (table: unknown) => ({
    values: (data: Record<string, unknown>) => ({
      then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        (async () => insertRow(table, data))().then(resolve, reject),
      returning: async (_fields?: unknown) => insertRow(table, data),
    }),
  }),
  update: (table: unknown) => ({
    set: (data: Record<string, unknown>) => ({
      where: (cond: unknown) => {
        const run = async () => applyUpdate(table, data, cond as Cond);
        return {
          then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            run().then(resolve, reject),
          returning: async (_fields?: unknown) => applyUpdate(table, data, cond as Cond),
        };
      },
    }),
  }),
  transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(fakeDb),
};

vi.mock("@/lib/db", () => ({
  getDb: () => fakeDb,
  getPool: () => null,
  isDbConfigured: () => true,
  checkDbReadable: async () => ({ ok: true }),
}));

const mockRequireAdmin = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => (mockRequireAdmin.fn as (...a: unknown[]) => unknown)(...args),
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    eq: (column: unknown, value: unknown) => ({ __testEq: true, column, value }),
    and: (...conds: unknown[]) => ({ __testAnd: true, conds }),
    inArray: (column: unknown, values: unknown[]) => ({ __testInArray: true, column, values }),
    gte: (column: unknown, value: unknown) => ({ __testGte: true, column, value }),
    desc: (...a: unknown[]) => ({ __testDesc: true, a }),
    asc: (...a: unknown[]) => ({ __testAsc: true, a }),
    sql: ((s: TemplateStringsArray, ...v: unknown[]) => ({ __testSql: true, s, v })) as unknown,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stripe mock: signature check + idempotent session creation keyed by the
// request idempotency key (mirrors Stripe's Idempotency-Key behavior).
vi.mock("stripe", () => {
  class FakeStripe {
    webhooks = {
      constructEvent: (body: string, sig: string, _secret: string) => {
        if (sig !== "valid-sig") throw new Error("Invalid signature");
        return JSON.parse(body);
      },
    };
    checkout = {
      sessions: {
        create: async (params: Record<string, unknown>, opts?: { idempotencyKey?: string }) => {
          const key = opts?.idempotencyKey;
          (state.idemKeysSeen as (string | undefined)[]).push(key);
          if (key && state.stripeByIdem.has(key)) return state.stripeByIdem.get(key);
          state.stripeSessionCounter += 1;
          const session = {
            id: `cs_test_${state.stripeSessionCounter}`,
            url: `https://checkout.stripe.com/pay/cs_test_${state.stripeSessionCounter}`,
          };
          if (key) state.stripeByIdem.set(key, session);
          return { ...session, params };
        },
      },
    };
    constructor(public key: string) {}
  }
  return { default: FakeStripe };
});

// Fulfillment-ledger mock data for /sponsor page tests.
const sponsorMock = vi.hoisted(() => ({
  entries: [] as unknown[],
  totals: { totalPounds: 0, totalDeliveries: 0 },
  fail: false,
}));
vi.mock("@/lib/fulfillment-ledger", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/fulfillment-ledger")>();
  const { vi: mockVi } = await import("vitest");
  return {
    ...mod,
    getPublicFulfillmentEntries: mockVi.fn(async () => {
      if (sponsorMock.fail) throw new Error("Fulfillment ledger unavailable.");
      return sponsorMock.entries;
    }),
    getPublicFulfillmentTotals: mockVi.fn(async () => {
      if (sponsorMock.fail) throw new Error("Fulfillment ledger unavailable.");
      return sponsorMock.totals;
    }),
  };
});

import { POST as checkoutPost } from "../app/api/sponsorship/checkout/route";
import { POST as webhookPost } from "../app/api/webhooks/stripe/route";
import { processStripeEvent } from "../lib/stripe-webhook";

function fakeDbForService(): never {
  return fakeDb as never;
}
import SponsorPage from "../app/sponsor/page";
import SponsorSuccessPage, { metadata as successMetadata } from "../app/sponsor/success/page";
import { createFulfillmentEntry } from "../lib/admin-actions";
import { isStripeSponsorshipEnabled } from "../lib/config";
import { getSponsorshipTier, sanitizeSponsorDisplayName, SPONSORSHIP_TIERS } from "../lib/sponsorship";
import { sponsorshipCheckoutSchema, fulfillmentEntrySchema, parseDateOnly, isValidUuid } from "../lib/validation";
import {
  PUBLIC_FULFILLMENT_KEYS,
  anonymizedRecipientLabel,
  toPublicEntry,
  toSafeDeliveredDate,
} from "../lib/fulfillment-ledger";

const ORIG_ENV = { ...process.env };
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.99.${Math.floor(ipCounter / 250) + 1}.${(ipCounter % 250) + 1}`;
}

function jsonPost(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": freshIp(), ...headers },
    body: JSON.stringify(body),
  });
}

function seedRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = `req-${state.requests.size + 1}-${Date.now().toString(36)}-1111-4111-8111-111111111111`;
  const row = {
    id,
    templeName: "Test Temple",
    city: "Houston",
    state: "TX",
    publicRef: `SVS-SEED-${state.requests.size + 1}`,
    publicListingConsent: true,
    publicListingStatus: "published",
        ...overrides,
    };
    if (!row.id) row.id = id;
    state.requests.set(String(row.id), row);
  return row;
}

function seedOrder(overrides: Record<string, unknown> = {}) {
  const n = state.orders.size + 1;
  const id = `so-seed-${n}`;
  const row = {
    id,
    publicRef: `SUP-SEED-${n}`,
    stripeCheckoutSessionId: `cs_test_seed_${n}`,
    stripePaymentIntentId: null,
    tierCode: "bag_25",
    amountCents: 3500,
    currency: "usd",
    estimatedPounds: 25,
    sponsorDisplayName: null,
    sponsorEmail: null,
    publicRecognitionConsent: false,
    checkoutAttemptKey: `seed-attempt-${n}`,
    termsVersion: "v1",
    termsAcceptedAt: new Date(),
    refundedAmountCents: 0,
    status: "pending",
    allocatedRequestId: null,
    createdAt: new Date(),
    paidAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
  state.orders.set(String(row.id), row as Record<string, unknown>);
  state.ordersBySession.set(String((row as Record<string, unknown>).stripeCheckoutSessionId), String(row.id));
  if (row.checkoutAttemptKey) state.ordersByAttempt.set(String(row.checkoutAttemptKey), String(row.id));
  if (row.stripePaymentIntentId) state.ordersByIntent.set(String(row.stripePaymentIntentId), String(row.id));
  return row as unknown as Record<string, unknown> & { id: string; status: string; stripeCheckoutSessionId: string };
}

function webhookReq(event: unknown, sig = "valid-sig"): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": sig, "x-forwarded-for": freshIp() },
    body: JSON.stringify(event),
  });
}

function completedEvent(row: { stripeCheckoutSessionId: string }, overrides: Record<string, unknown> = {}) {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: row.stripeCheckoutSessionId,
        payment_status: "paid",
        payment_intent: "pi_test_1",
        amount_total: 3500,
        currency: "usd",
        customer_details: { email: "Donor@Example.org" },
        ...overrides,
      },
    },
  };
}

const TEST_UUID_A = "11111111-1111-4111-8111-111111111111";
const TEST_UUID_B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  state.attempts.clear();
  state.orders.clear();
  state.ordersBySession.clear();
  state.ordersByAttempt.clear();
  state.ordersByIntent.clear();
  state.ordersByRef.clear();
  state.events.clear();
  state.ledger.length = 0;
  state.ledgerByKey.clear();
  state.requests.clear();
  state.buckets.length = 0;
  state.stripeSessionCounter = 0;
  state.stripeByIdem.clear();
  state.idemKeysSeen.length = 0;
  state.failNextOrderInsert = false;
  sponsorMock.entries = [];
  sponsorMock.totals = { totalPounds: 0, totalDeliveries: 0 };
  sponsorMock.fail = false;
  mockRequireAdmin.fn.mockReset();
  mockRequireAdmin.fn.mockResolvedValue({ email: "admin@example.org" });
  process.env.ENABLE_STRIPE_SPONSORSHIP = ORIG_ENV.ENABLE_STRIPE_SPONSORSHIP ?? "";
  process.env.STRIPE_SECRET_KEY = ORIG_ENV.STRIPE_SECRET_KEY ?? "";
  process.env.STRIPE_WEBHOOK_SECRET = ORIG_ENV.STRIPE_WEBHOOK_SECRET ?? "";
});

afterEach(() => {
  process.env.ENABLE_STRIPE_SPONSORSHIP = ORIG_ENV.ENABLE_STRIPE_SPONSORSHIP ?? "";
  process.env.STRIPE_SECRET_KEY = ORIG_ENV.STRIPE_SECRET_KEY ?? "";
  process.env.STRIPE_WEBHOOK_SECRET = ORIG_ENV.STRIPE_WEBHOOK_SECRET ?? "";
});

function enableStripe() {
  process.env.ENABLE_STRIPE_SPONSORSHIP = "true";
  process.env.STRIPE_SECRET_KEY = "sk_test_unit";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
}

describe("zero-key safe mode + webhook-secret gate", () => {
  it("isStripeSponsorshipEnabled requires flag true AND non-empty key", () => {
    expect(isStripeSponsorshipEnabled({ ENABLE_STRIPE_SPONSORSHIP: "true", STRIPE_SECRET_KEY: "sk_test_1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isStripeSponsorshipEnabled({ ENABLE_STRIPE_SPONSORSHIP: "true", STRIPE_SECRET_KEY: "  " } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isStripeSponsorshipEnabled({ ENABLE_STRIPE_SPONSORSHIP: "false", STRIPE_SECRET_KEY: "sk_test_1" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isStripeSponsorshipEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("checkout returns 503 when Stripe is disabled", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.ENABLE_STRIPE_SPONSORSHIP = "";
    const res = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", attemptKey: "testkey_123456", acknowledgesTerms: true }));
    expect(res.status).toBe(503);
  });

  it("checkout returns 503 when the webhook secret is missing (cannot verify paid events)", async () => {
    enableStripe();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await checkoutPost(
      jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", attemptKey: "testkey_123456", termsVersion: "v1", acknowledgesTerms: true })
    );
    expect(res.status).toBe(503);
  });

  it("webhook still processes when checkout flag is off, provided secrets exist", async () => {
    process.env.ENABLE_STRIPE_SPONSORSHIP = "";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const row = seedOrder();
    const res = await webhookPost(webhookReq(completedEvent(row, { payment_intent: "pi_keep_1" })));
    expect(res.status).toBe(200);
    expect(state.orders.get(String(row.id))!.status).toBe("paid");
  });

  it("webhook returns 503 when webhook secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await webhookPost(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid-sig", "x-forwarded-for": freshIp() },
        body: JSON.stringify({ id: "evt_x", type: "checkout.session.completed", data: { object: {} } }),
      })
    );
    expect(res.status).toBe(503);
  });
});

describe("server-side tier enforcement + terms", () => {
  it("rejects unknown tier codes, bad attempt keys, stale terms, and missing terms", async () => {
    enableStripe();
    const badTier = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_999", attemptKey: "validkey_12345678", termsVersion: "v1", acknowledgesTerms: true }));
    expect(badTier.status).toBe(422);
    const badKey = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", attemptKey: "x", termsVersion: "v1", acknowledgesTerms: true }));
    expect(badKey.status).toBe(422);
    const staleTerms = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", attemptKey: "validkey_12345678", termsVersion: "v0", acknowledgesTerms: true }));
    expect(staleTerms.status).toBe(422);
    const noTerms = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", attemptKey: "validkey_12345678", termsVersion: "v1", acknowledgesTerms: false }));
    expect(noTerms.status).toBe(422);
  });

  it("schema never accepts arbitrary prices and drops the recognition checkbox", () => {
    const parsed = sponsorshipCheckoutSchema.safeParse({
      tierCode: "bag_25",
      attemptKey: "validkey_12345678",
      termsVersion: "v1",
      acknowledgesTerms: true,
      amountCents: 1,
      unit_amount: 1,
      publicRecognitionConsent: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("amountCents");
      expect(parsed.data).not.toHaveProperty("unit_amount");
      expect(parsed.data).not.toHaveProperty("publicRecognitionConsent");
    }
    expect(getSponsorshipTier("bag_25")!.amountCents).toBe(3500);
    expect(SPONSORSHIP_TIERS.bag_10.amountCents).toBe(1500);
  });

  it("sanitizes sponsor display names to plain text <= 80 chars", () => {
    expect(sanitizeSponsorDisplayName(null)).toBeNull();
    expect(sanitizeSponsorDisplayName("   ")).toBeNull();
    expect(sanitizeSponsorDisplayName("The Patel Family")).toBe("The Patel Family");
    expect(sanitizeSponsorDisplayName("x".repeat(200))).toBe("x".repeat(80));
  });
});

describe("retry-safe checkout (actual production route)", () => {
  it("creates a pending order with server-side pricing + stored terms (mocked Stripe)", async () => {
    enableStripe();
    const res = await checkoutPost(
      jsonPost("/api/sponsorship/checkout", { tierCode: "bag_50", attemptKey: "retrykey_00000001", termsVersion: "v1", acknowledgesTerms: true })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.url).toContain("https://checkout.stripe.com");
    expect(data.publicRef).toMatch(/^SUP-/);
    const row = [...state.orders.values()][0];
    expect(row.tierCode).toBe("bag_50");
    expect(row.amountCents).toBe(6500);
    expect(row.estimatedPounds).toBe(50);
    expect(row.status).toBe("pending");
    expect(row.checkoutAttemptKey).toBe("retrykey_00000001");
    expect(row.termsVersion).toBe("v1");
    expect(row.termsAcceptedAt).toBeInstanceOf(Date);
    // Stripe idempotency key binds the attempt.
    expect(state.idemKeysSeen).toContain("sponsorship-checkout-retrykey_00000001");
  });

  it("repeated clicks with the same attempt key create only one Stripe session + order", async () => {
    enableStripe();
    const body = { tierCode: "bag_25", attemptKey: "dblclick_12345678", termsVersion: "v1", acknowledgesTerms: true };
    const first = await checkoutPost(jsonPost("/api/sponsorship/checkout", body));
    const second = await checkoutPost(jsonPost("/api/sponsorship/checkout", body));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(state.stripeSessionCounter).toBe(1);
    expect(state.orders.size).toBe(1);
    expect(await first.json().then((d) => d.url)).toBe(await second.json().then((d) => d.url));
  });

  it("conflicting reuse of an attempt key is rejected with 409", async () => {
    enableStripe();
    const first = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", attemptKey: "conflict_12345678", termsVersion: "v1", acknowledgesTerms: true }));
    expect(first.status).toBe(200);
    const second = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_100", attemptKey: "conflict_12345678", termsVersion: "v1", acknowledgesTerms: true }));
    expect(second.status).toBe(409);
    expect(state.orders.size).toBe(1);
  });

  it("Stripe success + local persistence failure stays safe and retry succeeds with the same session", async () => {
    enableStripe();
    const body = { tierCode: "bag_25", attemptKey: "crashkey_12345678", termsVersion: "v1", acknowledgesTerms: true };
    state.failNextOrderInsert = true;
    const failed = await checkoutPost(jsonPost("/api/sponsorship/checkout", body));
    expect(failed.status).toBe(500);
    expect(state.orders.size).toBe(0);
    const retry = await checkoutPost(jsonPost("/api/sponsorship/checkout", body));
    expect(retry.status).toBe(200);
    expect(state.stripeSessionCounter).toBe(1);
    expect(state.orders.size).toBe(1);
    const data = await retry.json();
    const row = [...state.orders.values()][0];
    expect(row.stripeCheckoutSessionId).toBe("cs_test_1");
    expect(data.publicRef).toBe(row.publicRef);
  });
});

describe("webhook payment-state safety (actual production route)", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
  });

  it("rejects missing/invalid signatures fail-closed with 400", async () => {
    const missing = await webhookPost(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "x-forwarded-for": freshIp() },
        body: JSON.stringify({ id: "evt_1", type: "charge.refunded", data: { object: {} } }),
      })
    );
    expect(missing.status).toBe(400);
    const bad = await webhookPost(webhookReq({ id: "evt_2", type: "checkout.session.completed", data: { object: {} } }, "bad-sig"));
    expect(bad.status).toBe(400);
  });

  it("never marks completed-unpaid as paid", async () => {
    const row = seedOrder();
    const res = await webhookPost(webhookReq(completedEvent(row, { payment_status: "unpaid", payment_intent: "pi_unpaid_1" })));
    expect(res.status).toBe(200);
    expect(state.orders.get(String(row.id))!.status).toBe("pending");
  });

  it("amount/currency mismatch never becomes paid", async () => {
    const rowA = seedOrder();
    const wrongAmount = await webhookPost(webhookReq({ ...completedEvent(rowA), id: "evt_amt_1", data: { object: { ...(completedEvent(rowA).data.object as object), amount_total: 1 } } }));
    expect(wrongAmount.status).toBe(200);
    expect(state.orders.get(String(rowA.id))!.status).toBe("pending");
    const rowB = seedOrder({ stripeCheckoutSessionId: "cs_cur_2", checkoutAttemptKey: "cur-2" });
    const wrongCur = await webhookPost(
      webhookReq({ id: "evt_cur_1", type: "checkout.session.completed", data: { object: { id: "cs_cur_2", payment_status: "paid", payment_intent: "pi_cur_1", amount_total: 3500, currency: "eur" } } })
    );
    expect(wrongCur.status).toBe(200);
    expect(state.orders.get(String(rowB.id))!.status).toBe("pending");
  });

  it("marks pending paid once and replays idempotently via stored event IDs", async () => {
    const row = seedOrder();
    const event = { ...completedEvent(row), id: "evt_paid_dup_1" };
    const first = await webhookPost(webhookReq(event));
    expect(first.status).toBe(200);
    const updated = state.orders.get(String(row.id))!;
    expect(updated.status).toBe("paid");
    expect(updated.stripePaymentIntentId).toBe("pi_test_1");
    expect(updated.sponsorEmail).toBe("donor@example.org");
    expect(state.events.has("evt_paid_dup_1")).toBe(true);
    const second = await webhookPost(webhookReq(event));
    expect(second.status).toBe(200);
    expect(state.orders.get(String(row.id))!.status).toBe("paid");
  });

  it("concurrent duplicate completed events keep a single paid transition", async () => {
    // Exercises the ACTUAL production service concurrently (the route's
    // signature-verification step is covered by the sequential tests above;
    // the race that matters lives in the transaction + unique event key).
    const row = seedOrder();
    const base = completedEvent(row, { payment_intent: "pi_conc_1" });
    const evt = { id: "evt_conc_1", type: base.type, data: base.data };
    const settled = await Promise.allSettled([
      processStripeEvent(fakeDbForService(), evt),
      processStripeEvent(fakeDbForService(), evt),
    ]);
    const fulfilled = settled.filter((s) => s.status === "fulfilled") as { status: "fulfilled"; value: { action: string } }[];
    const rejected = settled.filter((s) => s.status === "rejected") as { status: "rejected"; reason: unknown }[];
    // Exactly one worker wins the paid transition; the loser either sees the
    // stored event (duplicate) or loses the unique insert race (the route
    // maps that rejection to 200 { received: true }).
    expect(state.orders.get(String(row.id))!.status).toBe("paid");
    expect(state.events.size).toBe(1);
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.some((f) => f.value.action === "paid" || f.value.action === "duplicate")).toBe(true);
    if (rejected.length > 0) {
      expect(String((rejected[0].reason as Error)?.message ?? rejected[0].reason)).toMatch(/duplicate|unique/i);
    }
  });

  it("refund followed by delayed completion stays refunded (completed never overwrites refunded)", async () => {
    const row = seedOrder({ stripePaymentIntentId: "pi_seq_1", status: "paid", paidAt: new Date() });
    const refund = await webhookPost(
      webhookReq({ id: "evt_ref_seq_1", type: "charge.refunded", data: { object: { payment_intent: "pi_seq_1", amount: 3500, amount_refunded: 3500, refunded: true } } })
    );
    expect(refund.status).toBe(200);
    expect(state.orders.get(String(row.id))!.status).toBe("refunded");
    const late = await webhookPost(webhookReq({ ...completedEvent(row, { payment_intent: "pi_seq_1" }), id: "evt_late_1" }));
    expect(late.status).toBe(200);
    expect(state.orders.get(String(row.id))!.status).toBe("refunded");
  });

  it("expired only touches pending; paid/refunded are terminal", async () => {
    const pending = seedOrder();
    const expired = await webhookPost(webhookReq({ id: "evt_exp_1", type: "checkout.session.expired", data: { object: { id: pending.stripeCheckoutSessionId } } }));
    expect(expired.status).toBe(200);
    expect(state.orders.get(String(pending.id))!.status).toBe("expired");
    const paid = seedOrder({ stripeCheckoutSessionId: "cs_paid_9", checkoutAttemptKey: "paid-9", status: "paid", paidAt: new Date() });
    const keep = await webhookPost(webhookReq({ id: "evt_exp_2", type: "checkout.session.expired", data: { object: { id: "cs_paid_9" } } }));
    expect(keep.status).toBe(200);
    expect(state.orders.get(String(paid.id))!.status).toBe("paid");
  });

  it("partial refunds are not labeled as full refunds; full refunds are", async () => {
    const partial = seedOrder({ stripeCheckoutSessionId: "cs_part_1", checkoutAttemptKey: "part-1", stripePaymentIntentId: "pi_part_1", status: "paid", paidAt: new Date() });
    const pres = await webhookPost(
      webhookReq({ id: "evt_partial_1", type: "charge.refunded", data: { object: { payment_intent: "pi_part_1", amount: 3500, amount_refunded: 1000, refunded: false } } })
    );
    expect(pres.status).toBe(200);
    const pRow = state.orders.get(String(partial.id))!;
    expect(pRow.status).toBe("partially_refunded");
    expect(pRow.refundedAmountCents).toBe(1000);
    const full = seedOrder({ stripeCheckoutSessionId: "cs_full_1", checkoutAttemptKey: "full-1", stripePaymentIntentId: "pi_full_1", status: "paid", paidAt: new Date() });
    const fres = await webhookPost(
      webhookReq({ id: "evt_full_1", type: "charge.refunded", data: { object: { payment_intent: "pi_full_1", amount: 3500, amount_refunded: 3500, refunded: true } } })
    );
    expect(fres.status).toBe(200);
    expect(state.orders.get(String(full.id))!.status).toBe("refunded");
  });

  it("unknown relevant orders are NOT acknowledged: 500 retryable with no stored event", async () => {
    const res = await webhookPost(
      webhookReq({ id: "evt_unknown_1", type: "checkout.session.completed", data: { object: { id: "cs_missing_xyz", payment_status: "paid", amount_total: 3500, currency: "usd" } } })
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.retryable).toBe(true);
    expect(state.events.has("evt_unknown_1")).toBe(false);
    // Retry stays retryable (nothing was silently consumed).
    const retry = await webhookPost(
      webhookReq({ id: "evt_unknown_1", type: "checkout.session.completed", data: { object: { id: "cs_missing_xyz", payment_status: "paid", amount_total: 3500, currency: "usd" } } })
    );
    expect(retry.status).toBe(500);
  });

  it("async delayed-method events succeed only when paid; failures expire pending", async () => {
    const row = seedOrder({ stripeCheckoutSessionId: "cs_async_1", checkoutAttemptKey: "async-1" });
    const ok = await webhookPost(
      webhookReq({ id: "evt_async_ok", type: "checkout.session.async_payment_succeeded", data: { object: { id: "cs_async_1", payment_status: "paid", payment_intent: "pi_async_1", amount_total: 3500, currency: "usd" } } })
    );
    expect(ok.status).toBe(200);
    expect(state.orders.get(String(row.id))!.status).toBe("paid");
    const row2 = seedOrder({ stripeCheckoutSessionId: "cs_async_2", checkoutAttemptKey: "async-2" });
    const fail = await webhookPost(webhookReq({ id: "evt_async_fail", type: "checkout.session.async_payment_failed", data: { object: { id: "cs_async_2" } } }));
    expect(fail.status).toBe(200);
    expect(state.orders.get(String(row2.id))!.status).toBe("expired");
  });
});

describe("temple privacy in the public ledger (actual production gate)", () => {
  it("public key set never includes private fields", () => {
    expect([...PUBLIC_FULFILLMENT_KEYS].sort()).toEqual(
      ["city", "deliveredAt", "poundsDelivered", "publicRef", "recipientLabel", "state", "sugarProductLabel"].sort()
    );
    expect(PUBLIC_FULFILLMENT_KEYS).not.toContain("recordedBy" as never);
    expect(PUBLIC_FULFILLMENT_KEYS).not.toContain("internalNotes" as never);
    expect(PUBLIC_FULFILLMENT_KEYS).not.toContain("sponsorEmail" as never);
    expect(PUBLIC_FULFILLMENT_KEYS).not.toContain("donationRequestId" as never);
  });

  it("linked consenting+published temple shows name/city; otherwise anonymized without city", () => {
    const shown = toPublicEntry({
      publicRef: "SUP-1",
      storedRecipientLabel: "Stored",
      storedCity: "X",
      storedState: "TX",
      poundsDelivered: 50,
      sugarProductLabel: "Sugar",
      deliveredAt: new Date("2026-01-15T12:00:00Z"),
      linkedConsent: true,
      linkedStatus: "published",
      linkedTempleName: "Houston Temple",
      linkedCity: "Houston",
      linkedState: "TX",
    });
    expect(shown.recipientLabel).toBe("Houston Temple");
    expect(shown.city).toBe("Houston");

    for (const gate of [
      { linkedConsent: false, linkedStatus: "published" },
      { linkedConsent: true, linkedStatus: "unpublished" },
      { linkedConsent: true, linkedStatus: "private" },
      { linkedConsent: null, linkedStatus: null },
    ]) {
      const anon = toPublicEntry({
        publicRef: "SUP-2",
        storedRecipientLabel: "Secret Temple Name",
        storedCity: "Secret City",
        storedState: "TX",
        poundsDelivered: 50,
        sugarProductLabel: "Sugar",
        deliveredAt: new Date("2026-01-15T12:00:00Z"),
        linkedConsent: gate.linkedConsent as boolean | null,
        linkedStatus: gate.linkedStatus,
        linkedTempleName: "Secret Temple Name",
        linkedCity: "Secret City",
        linkedState: "TX",
      });
      expect(anon.recipientLabel).toBe("Participating Temple (TX)");
      expect(anon.city).toBeNull();
      expect(JSON.stringify(anon)).not.toContain("Secret");
    }
  });

  it("later unpublishing anonymizes the same historical entry", () => {
    const base = {
      publicRef: "SUP-9",
      storedRecipientLabel: "Houston Temple",
      storedCity: "Houston",
      storedState: "TX",
      poundsDelivered: 25,
      sugarProductLabel: "Sugar",
      deliveredAt: new Date("2026-01-15T12:00:00Z"),
      linkedTempleName: "Houston Temple",
      linkedCity: "Houston",
      linkedState: "TX",
    };
    const before = toPublicEntry({ ...base, linkedConsent: true, linkedStatus: "published" });
    expect(before.recipientLabel).toBe("Houston Temple");
    const after = toPublicEntry({ ...base, linkedConsent: true, linkedStatus: "unpublished" });
    expect(after.recipientLabel).toBe("Participating Temple (TX)");
    expect(after.city).toBeNull();
  });

  it("anonymized helper omits city-able output safely", () => {
    expect(anonymizedRecipientLabel("TX")).toBe("Participating Temple (TX)");
    expect(anonymizedRecipientLabel("xx")).toBe("Participating Temple (XX)");
    expect(anonymizedRecipientLabel("X")).toBe("Participating Temple");
    expect(anonymizedRecipientLabel(null)).toBe("Participating Temple");
  });
});

describe("admin fulfillment (actual production action)", () => {
  function form(data: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(data)) fd.set(k, v);
    return fd;
  }

  it("rejects unauthenticated submissions", async () => {
    mockRequireAdmin.fn.mockResolvedValue(null);
    await expect(
      createFulfillmentEntry(form({ idempotencyKey: "adminkey_12345678", state: "TX", poundsDelivered: "50", sugarProductLabel: "Sugar", deliveredAt: "2026-01-15" }))
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects invalid UUID linkage and missing linked rows", async () => {
    await expect(
      createFulfillmentEntry(form({ idempotencyKey: "adminkey_12345678", state: "TX", poundsDelivered: "50", sugarProductLabel: "Sugar", deliveredAt: "2026-01-15", donationRequestId: "not-a-uuid" }))
    ).rejects.toThrow("Invalid linked request");
    await expect(
      createFulfillmentEntry(form({ idempotencyKey: "adminkey_12345678", state: "TX", poundsDelivered: "50", sugarProductLabel: "Sugar", deliveredAt: "2026-01-15", donationRequestId: TEST_UUID_A }))
    ).rejects.toThrow("Linked request not found");
    await expect(
      createFulfillmentEntry(form({ idempotencyKey: "adminkey_12345678", state: "TX", poundsDelivered: "50", sugarProductLabel: "Sugar", deliveredAt: "2026-01-15", sponsorshipOrderId: TEST_UUID_B }))
    ).rejects.toThrow("Linked sponsorship order not found");
  });

  it("linked consenting+published request stores the temple name; non-consenting stores anonymized", async () => {
    const pub = seedRequest({ id: TEST_UUID_A, templeName: "Houston Temple", city: "Houston", state: "TX", publicListingConsent: true, publicListingStatus: "published" });
    expect(pub).toBeTruthy();
    await createFulfillmentEntry(
      form({ idempotencyKey: "adminkey_11111111", state: "TX", poundsDelivered: "50", sugarProductLabel: "Organic cane sugar", deliveredAt: "2026-01-15", donationRequestId: TEST_UUID_A })
    );
    expect(state.ledger[0].recipientLabel).toBe("Houston Temple");
    expect(state.ledger[0].city).toBe("Houston");

    const priv = seedRequest({ id: TEST_UUID_B, templeName: "Private Temple", city: "Austin", state: "TX", publicListingConsent: false, publicListingStatus: "private" });
    expect(priv).toBeTruthy();
    await createFulfillmentEntry(
      form({ idempotencyKey: "adminkey_22222222", state: "TX", poundsDelivered: "25", sugarProductLabel: "Sugar", deliveredAt: "2026-01-16", donationRequestId: TEST_UUID_B })
    );
    expect(state.ledger[1].recipientLabel).toBe("Participating Temple (TX)");
    expect(state.ledger[1].city).toBeNull();
    expect(JSON.stringify(state.ledger[1])).not.toContain("Private Temple");
  });

  it("unlinked deliveries are anonymized by default and repeat submissions are duplicate-safe", async () => {
    await createFulfillmentEntry(
      form({ idempotencyKey: "repeatkey_12345678", state: "CA", poundsDelivered: "10", sugarProductLabel: "Sugar", deliveredAt: "2026-01-15" })
    );
    await createFulfillmentEntry(
      form({ idempotencyKey: "repeatkey_12345678", state: "CA", poundsDelivered: "10", sugarProductLabel: "Sugar", deliveredAt: "2026-01-15" })
    );
    expect(state.ledger.length).toBe(1);
    expect(state.ledger[0].recipientLabel).toBe("Participating Temple (CA)");
    expect(state.ledger[0].city).toBeNull();
  });

  it("fulfillment schema defaults publicVisible to unchecked (false)", () => {
    const parsed = fulfillmentEntrySchema.safeParse({
      idempotencyKey: "adminkey_12345678",
      poundsDelivered: 10,
      sugarProductLabel: "Sugar",
      deliveredAt: "2026-01-15",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.publicVisible).toBe(false);
  });
});

describe("strict delivery dates", () => {
  it("rejects impossible dates like February 30", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(toSafeDeliveredDate("2026-02-30")).toBeNull();
    expect(toSafeDeliveredDate("2026-01-15")).toBeInstanceOf(Date);
  });
  it("admin rejects impossible delivery dates", async () => {
    await expect(
      createFulfillmentEntry(
        (() => {
          const fd = new FormData();
          fd.set("idempotencyKey", "datekey_12345678");
          fd.set("state", "TX");
          fd.set("poundsDelivered", "10");
          fd.set("sugarProductLabel", "Sugar");
          fd.set("deliveredAt", "2026-02-30");
          return fd;
        })()
      )
    ).rejects.toThrow("valid delivery date");
  });
  it("validates UUID linkage format", () => {
    expect(isValidUuid(TEST_UUID_A)).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });
});

describe("honest success page", () => {
  it("never asserts payment from a user-supplied ref and carries noindex", async () => {
    expect((successMetadata.robots as { index: boolean }).index).toBe(false);
    const node = await SponsorSuccessPage({ searchParams: Promise.resolve({ ref: "SUP-ARBITRARY" }) });
    const { container } = render(node);
    expect(container.textContent).not.toMatch(/your payment was received/i);
    expect(container.textContent).toMatch(/may still be processing/i);
    expect(container.textContent).toMatch(/not promised to map/i);
    expect(container.textContent).toContain("SUP-ARBITRARY");
  });
  it("renders neutrally without a ref", async () => {
    const node = await SponsorSuccessPage({ searchParams: Promise.resolve({}) });
    render(node);
    expect(screen.getByRole("heading", { name: /checkout returned/i })).toBeTruthy();
  });
});

describe("/sponsor page", () => {
  it("renders coming-soon state with support/temples links when Stripe is disabled", async () => {
    process.env.ENABLE_STRIPE_SPONSORSHIP = "";
    delete process.env.STRIPE_SECRET_KEY;
    const node = await SponsorPage({ searchParams: Promise.resolve({}) });
    render(node);
    expect(screen.getByRole("heading", { name: /sponsor vegan sugar/i })).toBeTruthy();
    expect(screen.getByText(/opening soon/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /offer support/i })).toHaveProperty(
      "href",
      expect.stringContaining("/support")
    );
    expect(screen.getByRole("link", { name: /browse temples/i })).toHaveProperty(
      "href",
      expect.stringContaining("/temples")
    );
    expect(screen.getByText(/pansophy llc/i)).toBeTruthy();
    expect(screen.getByText(/not tax-deductible/i)).toBeTruthy();
    expect(screen.getByText(/non-refundable/i)).toBeTruthy();
    expect(screen.getByText(/no public deliveries recorded yet/i)).toBeTruthy();
  });

  it("cancelled banner never claims conclusively that no charge occurred", async () => {
    process.env.ENABLE_STRIPE_SPONSORSHIP = "";
    const node = await SponsorPage({ searchParams: Promise.resolve({ cancelled: "1" }) });
    const { container } = render(node);
    expect(container.textContent).not.toMatch(/no charge was made/i);
    expect(container.textContent).toMatch(/may still be processing/i);
  });

  it("renders ledger totals and entries without any PII", async () => {
    process.env.ENABLE_STRIPE_SPONSORSHIP = "";
    sponsorMock.totals = { totalPounds: 75, totalDeliveries: 2 };
    sponsorMock.entries = [
      {
        publicRef: "SUP-PUB-0001",
        recipientLabel: "Houston Temple Kitchen",
        city: "Houston",
        state: "TX",
        poundsDelivered: 50,
        sugarProductLabel: "Organic cane sugar, 50 lb",
        deliveredAt: new Date("2026-01-15T12:00:00Z"),
      },
      {
        publicRef: "SUP-PUB-0002",
        recipientLabel: "Participating Temple (CA)",
        city: null,
        state: "CA",
        poundsDelivered: 25,
        sugarProductLabel: "Unrefined cane sugar, 25 lb",
        deliveredAt: new Date("2026-01-20T12:00:00Z"),
      },
    ];
    const node = await SponsorPage({ searchParams: Promise.resolve({}) });
    const { container } = render(node);
    expect(screen.getByText(/houston temple kitchen/i)).toBeTruthy();
    expect(screen.getByText(/participating temple \(ca\)/i)).toBeTruthy();
    expect(container.textContent).not.toContain("admin@example.org");
    expect(container.textContent).not.toContain("donor@example.org");
    expect(container.textContent).not.toContain("internal note");
  });

  it("degrades gracefully when the ledger query fails", async () => {
    process.env.ENABLE_STRIPE_SPONSORSHIP = "";
    sponsorMock.fail = true;
    const node = await SponsorPage({ searchParams: Promise.resolve({}) });
    render(node);
    expect(screen.getByText(/ledger is temporarily unavailable/i)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/pansophy llc/i)).toBeTruthy();
  });
});
