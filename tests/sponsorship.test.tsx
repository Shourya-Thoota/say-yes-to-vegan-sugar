/**
 * Part 3B unit coverage: zero-key safe mode, server-side tier enforcement,
 * webhook security/idempotency, privacy projection, and /sponsor rendering.
 * Real-PostgreSQL lifecycle coverage lives in tests/sponsorship-fulfillment-pg.test.ts.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { sponsorshipOrders, fulfillmentLedger } from "../lib/schema";

// ---------------------------------------------------------------------------
// Fake DB for sponsorship_orders + fulfillment_ledger + rate_limits.
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown>>(),
  ordersBySession: new Map<string, string>(),
  ordersByIntent: new Map<string, string>(),
  ledger: [] as Record<string, unknown>[],
  buckets: [] as { key: string; windowStart: Date; count: number }[],
  stripeSessionCounter: 0,
}));

function windowOf(v: unknown): number {
  const d = v instanceof Date ? v : new Date(String(v));
  return d.getTime();
}

const fakeDb: {
  select: (_fields?: unknown) => {
    from: (table: unknown) => {
      where: (cond: unknown) => {
        limit: (n: number) => Promise<Record<string, unknown>[]>;
        then?: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
      } & {
        orderBy: (..._a: unknown[]) => {
          limit: (n: number) => Promise<Record<string, unknown>[]>;
        };
      };
    } & {
      orderBy: (..._a: unknown[]) => {
        limit: (n: number) => Promise<Record<string, unknown>[]>;
        where?: (cond: unknown) => { limit: (n: number) => Promise<Record<string, unknown>[]> };
      };
    };
  };
  insert: (table: unknown) => {
    values: (data: Record<string, unknown>) => {
      then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
      returning: () => Promise<unknown>;
    };
  };
  update: (table: unknown) => {
    set: (data: Record<string, unknown>) => {
      where: (cond: unknown) => Promise<unknown[]>;
    };
  };
} = {
  select: (_fields?: unknown) => {
    const builder: Record<string, unknown> = {};
    const makeWhere = (table: unknown) => (cond: unknown) => {
      const c = cond as { __testEq?: boolean; column?: unknown; value?: unknown } | null;
      const run = async (): Promise<Record<string, unknown>[]> => {
        if (table === sponsorshipOrders) {
          if (!c || c.__testEq !== true) return [...state.orders.values()];
          const { rateLimits } = await import("../lib/schema");
          if (c.column === (rateLimits as unknown as Record<string, unknown>).key) return [];
          return [...state.orders.values()];
        }
        if (table === fulfillmentLedger) return [...state.ledger];
        const { rateLimits } = await import("../lib/schema");
        if (table === rateLimits) {
          if (!c || (c as {__testEq?:boolean}).__testEq !== true) return [];
          return [];
        }
        return [];
      };
      return {
        limit: (_n: number) => run(),
        orderBy: (..._a: unknown[]) => ({ limit: (_n: number) => run() }),
      };
    };
    // For simplicity tests query orders via helper functions below that
    // bypass drizzle conditions and read `state` directly.
    void builder;
    return {
      from: (table: unknown) => ({
        where: makeWhere(table),
        orderBy: (..._a: unknown[]) => ({ limit: async () => {
          if (table === sponsorshipOrders) return [...state.orders.values()];
          if (table === fulfillmentLedger) return [...state.ledger];
          return [];
        }}),
      }),
    } as unknown as ReturnType<typeof fakeDb.select>;
  },
  insert: (table: unknown) => ({
    values: (data: Record<string, unknown>) => ({
      then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(insertRow(table, data)).then(resolve, reject),
      returning: () => Promise.resolve(insertRow(table, data)),
    }),
  }),
  update: (table: unknown) => ({
    set: (data: Record<string, unknown>) => ({
      where: async (cond: unknown) => {
        const c = cond as { __testEq?: boolean; column?: unknown; value?: unknown } | null;
        if (table === sponsorshipOrders && c?.__testEq === true) {
          const { sponsorshipOrders: so } = await import("../lib/schema");
          if (c.column === (so as unknown as Record<string, unknown>).id) {
            const row = state.orders.get(String(c.value ?? ""));
            if (row) Object.assign(row, data);
          } else if (c.column === (so as unknown as Record<string, unknown>).stripeCheckoutSessionId) {
            const id = state.ordersBySession.get(String(c.value ?? ""));
            const row = id ? state.orders.get(id) : undefined;
            if (row) {
              Object.assign(row, data);
              if (data.stripePaymentIntentId && typeof data.stripePaymentIntentId === "string") {
                state.ordersByIntent.set(data.stripePaymentIntentId, row.id as string);
              }
            }
          } else if (c.column === (so as unknown as Record<string, unknown>).stripePaymentIntentId) {
            const id = state.ordersByIntent.get(String(c.value ?? ""));
            const row = id ? state.orders.get(id) : undefined;
            if (row) Object.assign(row, data);
          }
        }
        if (table === fulfillmentLedger && c?.__testEq === true) {
          const row = state.ledger.find((r) => r.id === String(c.value ?? ""));
          if (row) Object.assign(row, data);
        }
        return [];
      },
    }),
  }),
};

function insertRow(table: unknown, data: Record<string, unknown>): unknown {
  if (table === sponsorshipOrders) {
    const id = `so-${state.orders.size + 1}-${Date.now().toString(36)}`;
    const row = { id, ...data };
    state.orders.set(id, row);
    if (data.stripeCheckoutSessionId) state.ordersBySession.set(String(data.stripeCheckoutSessionId), id);
    if (data.stripePaymentIntentId) state.ordersByIntent.set(String(data.stripePaymentIntentId), id);
    return [row];
  }
  if (table === fulfillmentLedger) {
    const row = { id: `fl-${state.ledger.length + 1}`, ...data };
    state.ledger.push(row);
    return [row];
  }
  // rate_limits
  state.buckets.push({
    key: String(data.key),
    windowStart: data.windowStart instanceof Date ? data.windowStart : new Date(String(data.windowStart)),
    count: Number(data.count ?? 1),
  });
  return [];
}

vi.mock("@/lib/db", () => ({
  getDb: () => fakeDb,
  getPool: () => null,
  isDbConfigured: () => true,
  checkDbReadable: async () => ({ ok: true }),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    eq: (column: unknown, value: unknown) => ({ __testEq: true, column, value }),
    and: (...conds: unknown[]) => ({ __testAnd: true, conds }),
    gte: (column: unknown, value: unknown) => ({ __testGte: true, column, value }),
    desc: (...a: unknown[]) => ({ __testDesc: true, a }),
    asc: (...a: unknown[]) => ({ __testAsc: true, a }),
    sql: ((s: TemplateStringsArray, ...v: unknown[]) => ({ __testSql: true, s, v })) as unknown,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stripe mock: constructEvent succeeds only with signature "valid-sig".
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
        create: async (params: Record<string, unknown>) => {
          state.stripeSessionCounter += 1;
          return {
            id: `cs_test_${state.stripeSessionCounter}`,
            url: `https://checkout.stripe.com/pay/cs_test_${state.stripeSessionCounter}`,
            ...params,
          };
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
import SponsorPage from "../app/sponsor/page";
import { isStripeSponsorshipEnabled } from "../lib/config";
import { getSponsorshipTier, sanitizeSponsorDisplayName, SPONSORSHIP_TIERS } from "../lib/sponsorship";
import { sponsorshipCheckoutSchema } from "../lib/validation";
import { PUBLIC_FULFILLMENT_KEYS } from "../lib/fulfillment-ledger";

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

beforeEach(() => {
  state.orders.clear();
  state.ordersBySession.clear();
  state.ordersByIntent.clear();
  state.ledger.length = 0;
  state.buckets.length = 0;
  state.stripeSessionCounter = 0;
  sponsorMock.entries = [];
  sponsorMock.totals = { totalPounds: 0, totalDeliveries: 0 };
  sponsorMock.fail = false;
  process.env.ENABLE_STRIPE_SPONSORSHIP = ORIG_ENV.ENABLE_STRIPE_SPONSORSHIP ?? "";
  process.env.STRIPE_SECRET_KEY = ORIG_ENV.STRIPE_SECRET_KEY ?? "";
  process.env.STRIPE_WEBHOOK_SECRET = ORIG_ENV.STRIPE_WEBHOOK_SECRET ?? "";
});

afterEach(() => {
  process.env.ENABLE_STRIPE_SPONSORSHIP = ORIG_ENV.ENABLE_STRIPE_SPONSORSHIP ?? "";
  process.env.STRIPE_SECRET_KEY = ORIG_ENV.STRIPE_SECRET_KEY ?? "";
  process.env.STRIPE_WEBHOOK_SECRET = ORIG_ENV.STRIPE_WEBHOOK_SECRET ?? "";
});

describe("zero-key safe mode gate", () => {
  it("isStripeSponsorshipEnabled requires flag true AND non-empty key", () => {
    expect(isStripeSponsorshipEnabled({ ENABLE_STRIPE_SPONSORSHIP: "true", STRIPE_SECRET_KEY: "sk_test_1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isStripeSponsorshipEnabled({ ENABLE_STRIPE_SPONSORSHIP: "true", STRIPE_SECRET_KEY: "  " } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isStripeSponsorshipEnabled({ ENABLE_STRIPE_SPONSORSHIP: "false", STRIPE_SECRET_KEY: "sk_test_1" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isStripeSponsorshipEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("checkout returns 503 when Stripe is disabled", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.ENABLE_STRIPE_SPONSORSHIP = "";
    const res = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", acknowledgesTerms: true }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("webhook returns 503 when webhook secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await webhookPost(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid-sig", "x-forwarded-for": freshIp() },
        body: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
      })
    );
    expect(res.status).toBe(503);
  });
});

describe("server-side tier enforcement", () => {
  it("rejects unknown tier codes and missing terms at validation (422)", async () => {
    process.env.ENABLE_STRIPE_SPONSORSHIP = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    const badTier = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_999", acknowledgesTerms: true }));
    expect(badTier.status).toBe(422);
    const noTerms = await checkoutPost(jsonPost("/api/sponsorship/checkout", { tierCode: "bag_10", acknowledgesTerms: false }));
    expect(noTerms.status).toBe(422);
  });

  it("schema never accepts arbitrary prices", () => {
    const parsed = sponsorshipCheckoutSchema.safeParse({
      tierCode: "bag_25",
      acknowledgesTerms: true,
      amountCents: 1,
      unit_amount: 1,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("amountCents");
      expect(parsed.data).not.toHaveProperty("unit_amount");
    }
    const tier = getSponsorshipTier("bag_25")!;
    expect(tier.amountCents).toBe(3500);
    expect(SPONSORSHIP_TIERS.bag_10.amountCents).toBe(1500);
    expect(SPONSORSHIP_TIERS.bag_50.amountCents).toBe(6500);
    expect(SPONSORSHIP_TIERS.bag_100.amountCents).toBe(12500);
  });

  it("sanitizes sponsor display names to plain text <= 80 chars", () => {
    expect(sanitizeSponsorDisplayName(null)).toBeNull();
    expect(sanitizeSponsorDisplayName("   ")).toBeNull();
    expect(sanitizeSponsorDisplayName("The Patel Family")).toBe("The Patel Family");
    expect(sanitizeSponsorDisplayName("x".repeat(200))).toBe("x".repeat(80));
  });

  it("creates a pending order with server-side pricing (mocked Stripe)", async () => {
    process.env.ENABLE_STRIPE_SPONSORSHIP = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    const res = await checkoutPost(
      jsonPost("/api/sponsorship/checkout", {
        tierCode: "bag_50",
        sponsorDisplayName: "  Test Family  ",
        publicRecognitionConsent: true,
        acknowledgesTerms: true,
      })
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
    expect(row.sponsorDisplayName).toBe("Test Family");
  });
});

describe("webhook security and idempotency", () => {
  function seedOrder(overrides: Record<string, unknown> = {}) {
    const id = `so-seed-${state.orders.size + 1}`;
    const row = {
      id,
      publicRef: `SUP-SEED-${state.orders.size + 1}`,
      stripeCheckoutSessionId: `cs_test_seed_${state.orders.size + 1}`,
      stripePaymentIntentId: null,
      tierCode: "bag_25",
      amountCents: 3500,
      currency: "usd",
      estimatedPounds: 25,
      sponsorDisplayName: null,
      sponsorEmail: null,
      publicRecognitionConsent: false,
      status: "pending",
      allocatedRequestId: null,
      createdAt: new Date(),
      paidAt: null,
      updatedAt: new Date(),
      ...overrides,
    };
    state.orders.set(id, row);
    state.ordersBySession.set(row.stripeCheckoutSessionId as string, id);
    return row;
  }

  function webhookReq(event: unknown, sig = "valid-sig"): Request {
    return new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": sig, "x-forwarded-for": freshIp() },
      body: JSON.stringify(event),
    });
  }

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
  });

  it("rejects missing signature with 400", async () => {
    const res = await webhookPost(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "x-forwarded-for": freshIp() },
        body: JSON.stringify({ type: "charge.refunded", data: { object: {} } }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid signatures fail-closed with 400", async () => {
    const res = await webhookPost(webhookReq({ type: "checkout.session.completed", data: { object: {} } }, "bad-sig"));
    expect(res.status).toBe(400);
  });

  it("marks pending order paid and replays idempotently", async () => {
    const row = seedOrder();
    const event = {
      type: "checkout.session.completed",
      data: { object: { id: row.stripeCheckoutSessionId, payment_intent: "pi_test_1", customer_details: { email: "Donor@Example.org" } } },
    };
    const first = await webhookPost(webhookReq(event));
    expect(first.status).toBe(200);
    expect((await first.json()).received).toBe(true);
    const updated = state.orders.get(row.id as string)!;
    expect(updated.status).toBe("paid");
    expect(updated.stripePaymentIntentId).toBe("pi_test_1");
    expect(updated.sponsorEmail).toBe("donor@example.org");
    expect(updated.paidAt).toBeInstanceOf(Date);

    const second = await webhookPost(webhookReq(event));
    expect(second.status).toBe(200);
    const after = state.orders.get(row.id as string)!;
    expect(after.status).toBe("paid");
  });

  it("expires pending rows but never overwrites paid rows", async () => {
    const pending = seedOrder();
    const expired = await webhookPost(webhookReq({ type: "checkout.session.expired", data: { object: { id: pending.stripeCheckoutSessionId } } }));
    expect(expired.status).toBe(200);
    expect(state.orders.get(pending.id as string)!.status).toBe("expired");

    const paid = seedOrder({ status: "paid", paidAt: new Date() });
    const keep = await webhookPost(webhookReq({ type: "checkout.session.expired", data: { object: { id: paid.stripeCheckoutSessionId } } }));
    expect(keep.status).toBe(200);
    expect(state.orders.get(paid.id as string)!.status).toBe("paid");
  });
});

describe("fulfillment privacy projection", () => {
  it("public key set never includes private fields", () => {
    expect([...PUBLIC_FULFILLMENT_KEYS].sort()).toEqual(
      ["city", "deliveredAt", "poundsDelivered", "publicRef", "recipientLabel", "state", "sugarProductLabel"].sort()
    );
    expect(PUBLIC_FULFILLMENT_KEYS).not.toContain("recordedBy" as never);
    expect(PUBLIC_FULFILLMENT_KEYS).not.toContain("internalNotes" as never);
    expect(PUBLIC_FULFILLMENT_KEYS).not.toContain("sponsorEmail" as never);
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
    // Legal disclosures are always visible.
    expect(screen.getByText(/pansophy llc/i)).toBeTruthy();
    expect(screen.getByText(/not tax-deductible/i)).toBeTruthy();
    expect(screen.getByText(/non-refundable/i)).toBeTruthy();
    // Empty ledger dignity.
    expect(screen.getByText(/no public deliveries recorded yet/i)).toBeTruthy();
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
