/**
 * Isolated form-submission coverage for the three public handlers.
 *
 * No live PostgreSQL is available in this sandbox (no psql/initdb binaries,
 * Docker socket denied, no sudo), and production DATABASE_URL is never used.
 * These tests therefore exercise the real route handlers (`app/api/...`)
 * against an in-memory fake that implements the exact drizzle calls the
 * routes make (select-by-idempotency-key, insert, update, transaction),
 * including the persistent rate-limit buckets. The dedicated rate-limit
 * tests use the real in-memory limiter fallback (getDb null) to prove the
 * 429 wiring; persistence tests run with the fake-backed limiter so no
 * request bypasses rate limiting silently.
 *
 * All payloads are synthetic (example.org). Nothing leaves the process;
 * stores are cleared after each test.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  donationRequests,
  supportOffers,
  contactInquiries,
  statusHistory,
  rateLimits,
} from "../lib/schema";

// ---------------------------------------------------------------------------
// In-memory fake DB (hoisted so vi.mock closures can see it).
// ---------------------------------------------------------------------------
const fakeState = vi.hoisted(() => ({
  donation: new Map<string, Record<string, unknown>>(),
  support: new Map<string, Record<string, unknown>>(),
  contact: new Map<string, Record<string, unknown>>(),
  history: [] as Record<string, unknown>[],
  failInserts: false,
  nullDb: false,
  idCounter: 0,
  buckets: [] as { key: string; windowStart: Date; count: number }[],
}));

function storeForTable(table: unknown): Map<string, Record<string, unknown>> | null {
  if (table === donationRequests) return fakeState.donation;
  if (table === supportOffers) return fakeState.support;
  if (table === contactInquiries) return fakeState.contact;
  return null;
}

function windowOf(v: unknown): number {
  const d = v instanceof Date ? v : new Date(String(v));
  return d.getTime();
}

function lookupRateLimit(cond: unknown): Record<string, unknown>[] {
  const c = cond as { __testAnd?: boolean; conds?: unknown[] } | null;
  let keyVal: string | null = null;
  let windowVal: unknown = null;
  const parts = c && c.__testAnd ? c.conds ?? [] : [cond];
  for (const p of parts) {
    const q = p as { __testEq?: boolean; __testGte?: boolean; column?: unknown; value?: unknown };
    if (q && q.__testEq && q.column === rateLimits.key) keyVal = String(q.value);
    if (q && (q.__testEq || q.__testGte) && q.column === rateLimits.windowStart) windowVal = q.value;
  }
  if (keyVal === null || windowVal === null) return [];
  const w = windowOf(windowVal);
  return fakeState.buckets
    .filter((b) => b.key === keyVal && b.windowStart.getTime() >= w)
    .map((b) => ({ ...b }));
}

function lookupByEq(table: unknown, cond: unknown): Record<string, unknown>[] {
  if (table === rateLimits) return lookupRateLimit(cond);
  const c = cond as { __testEq?: boolean; column?: unknown; value?: unknown } | null;
  if (!c || c.__testEq !== true) return [];
  const store = storeForTable(table);
  if (!store) return [];
  // Routes only ever look up by idempotency key (or public ref on retry).
  const key = String(c.value ?? "");
  const row = store.get(key);
  if (row) return [{ publicRef: row.publicRef }];
  // Fall back: scan for a matching publicRef value.
  for (const r of store.values()) {
    if (r.publicRef === c.value) return [{ publicRef: r.publicRef }];
  }
  return [];
}

function makeInsert(table: unknown) {
  return {
    values(data: Record<string, unknown>) {
      const exec = async (): Promise<unknown> => {
        if (fakeState.failInserts) throw new Error("synthetic database failure (test)");
        if (table === statusHistory) {
          fakeState.history.push({ ...data });
          return [];
        }
        if (table === rateLimits) {
          const row = {
            key: String(data.key),
            windowStart:
              data.windowStart instanceof Date
                ? data.windowStart
                : new Date(String(data.windowStart)),
            count: Number(data.count ?? 1),
          };
          fakeState.buckets.push(row);
          return [];
        }
        const store = storeForTable(table);
        if (!store) throw new Error("unknown table (test fake)");
        const k = String(data.idempotencyKey ?? "");
        if (store.has(k)) {
          throw new Error(
            'duplicate key value violates unique constraint "test_idempotency_key_uidx"'
          );
        }
        fakeState.idCounter += 1;
        const row: Record<string, any> = { id: `test-id-${fakeState.idCounter}`, ...data };
        store.set(k, row);
        return [{ id: row.id, publicRef: row.publicRef }];
      };
      // Support both `await insert().values(x)` and `await insert().values(x).returning(...)`.
      return {
        then(
          resolve?: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown
        ) {
          return exec().then(resolve, reject);
        },
        returning: () => exec(),
      };
    },
  };
}

const fakeDb: any = {
  select: (_fields?: unknown) => ({
    from: (table: unknown) => ({
      where: (cond: unknown) => ({
        limit: async (_n: number) => lookupByEq(table, cond) as { publicRef: unknown }[],
      }),
    }),
  }),
  insert: (table: unknown) => makeInsert(table),
  update: (table: unknown) => ({
    set: (_data: unknown) => ({
      where: async (cond: unknown) => {
        if (table === rateLimits) {
          for (const b of lookupRateLimit(cond)) {
            const target = fakeState.buckets.find(
              (r) => r.key === (b as { key: string }).key
            );
            if (target) target.count += 1;
          }
        }
        return [];
      },
    }),
  }),
  transaction: async <T>(fn: (tx: typeof fakeDb) => Promise<T>): Promise<T> => {
    const tx = {
      ...fakeDb,
      insert: (table: unknown) => makeInsert(table),
    };
    return fn(tx as typeof fakeDb);
  },
};

vi.mock("@/lib/db", () => ({
  getDb: () => (fakeState.nullDb ? null : fakeDb),
  getPool: () => null,
  isDbConfigured: () => false,
  checkDbReadable: async () => ({ ok: false }),
}));

// Make drizzle's eq() transparent so the fake can filter by key.
// All other helpers pass through to the real implementation.
vi.mock("drizzle-orm", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    eq: (column: unknown, value: unknown) => ({ __testEq: true, column, value }),
    and: (...conds: unknown[]) => ({ __testAnd: true, conds }),
    gte: (column: unknown, value: unknown) => ({ __testGte: true, column, value }),
  };
});

const authState = vi.hoisted(() => ({ admin: null as { email: string } | null }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => authState.admin,
}));

import { POST as requestsPost } from "../app/api/requests/route";
import { POST as supportPost } from "../app/api/support/route";
import { POST as contactPost } from "../app/api/contact/route";
import { GET as exportGet } from "../app/api/admin/export/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let keyCounter = 0;
function synthKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-synth-${Date.now().toString(36)}-${keyCounter}`.slice(0, 64);
}
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.99.${Math.floor(ipCounter / 250) + 1}.${(ipCounter % 250) + 1}`;
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
    templeName: "Synthetic Test Temple",
    templeWebsite: "",
    streetAddress: "1 Synthetic Way",
    addressLine2: "",
    city: "Houston",
    state: "TX",
    zipCode: "77001",
    contactName: "Synthetic Person",
    contactRole: "Trustee",
    contactEmail: "Synthetic-Test@Example.org",
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
    email: "Helper-Synth@Example.org",
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
    email: "Inquirer-Synth@Example.org",
    subject: "Synthetic question",
    message: "Is this synthetic test message long enough to be valid?",
    privacyConsent: true,
  };
}

const PUBLIC_KEYS = new Set(["ok", "ref", "deduped", "message", "errors"]);

beforeEach(() => {
  delete process.env.DATABASE_URL;
  authState.admin = null;
  fakeState.failInserts = false;
  fakeState.nullDb = false;
});

afterEach(() => {
  // Clean up only the synthetic rows created by these tests.
  fakeState.donation.clear();
  fakeState.support.clear();
  fakeState.contact.clear();
  fakeState.history.length = 0;
  fakeState.buckets.length = 0;
  fakeState.failInserts = false;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("request-sugar submission (isolated fake DB, synthetic data)", () => {
  it("persists a valid submission with the expected fields", async () => {
    const key = synthKey("req");
    const res = await requestsPost(post(validDonation(key), freshIp()));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.ref).toMatch(/^SVS-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const row = fakeState.donation.get(key);
    expect(row).toBeTruthy();
    expect(row!.templeName).toBe("Synthetic Test Temple");
    expect(row!.city).toBe("Houston");
    expect(row!.state).toBe("TX");
    expect(row!.zipCode).toBe("77001");
    expect(row!.contactEmail).toBe("synthetic-test@example.org"); // lowercased
    expect(row!.quantityPounds).toBe(50);
    expect(row!.intendedUse).toEqual(["prasadam"]);
    expect(row!.privacyConsent).toBe(true);
    expect(row!.authorized).toBe(true);
    expect(row!.understandsNoGuarantee).toBe(true);
    expect(row!.status).toBe("submitted");
    expect(row!.publicRef).toBe(data.ref);
    // Audit row written alongside the request.
    expect(fakeState.history.length).toBe(1);
    expect(fakeState.history[0].toStatus).toBe("submitted");
  });

  it("creates no record for an invalid submission", async () => {
    const before = fakeState.donation.size;
    const res = await requestsPost(
      post({ ...validDonation(synthKey("bad")), templeName: "", zipCode: "bad" }, freshIp())
    );
    expect(res.status).toBe(422);
    expect((await res.json()).ok).toBe(false);
    expect(fakeState.donation.size).toBe(before);
    expect(fakeState.history.length).toBe(0);
  });

  it("retrying the same idempotency key does not create a duplicate", async () => {
    const key = synthKey("dup");
    const first = await requestsPost(post(validDonation(key), freshIp()));
    expect(first.status).toBe(201);
    const refA = (await first.json()).ref;

    const second = await requestsPost(post(validDonation(key), freshIp()));
    expect(second.status).toBe(200);
    const dataB = await second.json();
    expect(dataB.ok).toBe(true);
    expect(dataB.ref).toBe(refA);
    expect(dataB.deduped).toBe(true);
    expect(fakeState.donation.size).toBe(1);
  });

  it("concurrent retries with the same key converge on one record", async () => {
    const key = synthKey("race");
    const [a, b] = await Promise.all([
      requestsPost(post(validDonation(key), freshIp())),
      requestsPost(post(validDonation(key), freshIp())),
    ]);
    const da = await a.json();
    const db = await b.json();
    expect(da.ok).toBe(true);
    expect(db.ok).toBe(true);
    expect(da.ref).toBe(db.ref);
    expect(fakeState.donation.size).toBe(1);
  });

  it("database failure is an honest error, not a false success", async () => {
    fakeState.failInserts = true;
    const key = synthKey("fail");
    const res = await requestsPost(post(validDonation(key), freshIp()));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.ref).toBeUndefined();
    expect(data.errors?._form).toBeTruthy();
    expect(fakeState.donation.has(key)).toBe(false);
  });

  it("enforces privacy consent and required acknowledgments server-side", async () => {
    for (const patch of [
      { privacyConsent: false },
      { authorized: false },
      { understandsNoGuarantee: false },
    ]) {
      const before = fakeState.donation.size;
      const res = await requestsPost(
        post({ ...validDonation(synthKey("consent")), ...patch }, freshIp())
      );
      expect(res.status).toBe(422);
      expect(fakeState.donation.size).toBe(before);
    }
  });

  it("does not expose sensitive fields in public responses", async () => {
    const key = synthKey("leak");
    const res = await requestsPost(post(validDonation(key), freshIp()));
    const data = await res.json();
    for (const k of Object.keys(data)) expect(PUBLIC_KEYS.has(k)).toBe(true);
    const raw = JSON.stringify(data);
    expect(raw).not.toContain("synthetic-test@example.org");
    expect(raw).not.toContain("Synthetic Person");
  });
});

describe("support-offer submission (isolated fake DB, synthetic data)", () => {
  it("persists a valid support offer", async () => {
    const key = synthKey("sup");
    const res = await supportPost(post(validSupport(key), freshIp()));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.ref).toMatch(/^SUP-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const row = fakeState.support.get(key);
    expect(row!.name).toBe("Synthetic Helper");
    expect(row!.email).toBe("helper-synth@example.org");
    expect(row!.supportType).toBe("volunteer");
    expect(row!.privacyConsent).toBe(true);
    expect(row!.publicRef).toBe(data.ref);
  });

  it("rejects invalid offers without persisting, dedupes retries, and fails honestly on DB errors", async () => {
    const bad = await supportPost(
      post({ ...validSupport(synthKey("supbad")), message: "short" }, freshIp())
    );
    expect(bad.status).toBe(422);
    expect(fakeState.support.size).toBe(0);

    const key = synthKey("supdup");
    const first = await supportPost(post(validSupport(key), freshIp()));
    const refA = (await first.json()).ref;
    const second = await supportPost(post(validSupport(key), freshIp()));
    expect((await second.json()).ref).toBe(refA);
    expect(fakeState.support.size).toBe(1);

    fakeState.failInserts = true;
    const failed = await supportPost(post(validSupport(synthKey("supfail")), freshIp()));
    expect(failed.status).toBe(500);
    expect((await failed.json()).ok).toBe(false);
  });

  it("requires privacy consent and keeps responses free of PII", async () => {
    const res = await supportPost(
      post({ ...validSupport(synthKey("supconsent")), privacyConsent: false }, freshIp())
    );
    expect(res.status).toBe(422);
    expect(fakeState.support.size).toBe(0);

    const okRes = await supportPost(post(validSupport(synthKey("supleak")), freshIp()));
    const data = await okRes.json();
    for (const k of Object.keys(data)) expect(PUBLIC_KEYS.has(k)).toBe(true);
    expect(JSON.stringify(data)).not.toContain("helper-synth@example.org");
  });
});

describe("contact submission (isolated fake DB, synthetic data)", () => {
  it("persists a valid contact inquiry", async () => {
    const key = synthKey("con");
    const res = await contactPost(post(validContact(key), freshIp()));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.ref).toMatch(/^CON-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const row = fakeState.contact.get(key);
    expect(row!.name).toBe("Synthetic Inquirer");
    expect(row!.email).toBe("inquirer-synth@example.org");
    expect(row!.subject).toBe("Synthetic question");
    expect(row!.privacyConsent).toBe(true);
    expect(row!.publicRef).toBe(data.ref);
  });

  it("rejects invalid inquiries without persisting, dedupes retries, and fails honestly on DB errors", async () => {
    const bad = await contactPost(
      post({ ...validContact(synthKey("conbad")), message: "short" }, freshIp())
    );
    expect(bad.status).toBe(422);
    expect(fakeState.contact.size).toBe(0);

    const key = synthKey("condup");
    const refA = (await (await contactPost(post(validContact(key), freshIp()))).json()).ref;
    const second = await contactPost(post(validContact(key), freshIp()));
    expect((await second.json()).ref).toBe(refA);
    expect(fakeState.contact.size).toBe(1);

    fakeState.failInserts = true;
    const failed = await contactPost(post(validContact(synthKey("confail")), freshIp()));
    expect(failed.status).toBe(500);
    expect((await failed.json()).ok).toBe(false);
  });

  it("requires privacy consent and keeps responses free of PII", async () => {
    const res = await contactPost(
      post({ ...validContact(synthKey("conconsent")), privacyConsent: false }, freshIp())
    );
    expect(res.status).toBe(422);
    expect(fakeState.contact.size).toBe(0);

    const okRes = await contactPost(post(validContact(synthKey("conleak")), freshIp()));
    const data = await okRes.json();
    for (const k of Object.keys(data)) expect(PUBLIC_KEYS.has(k)).toBe(true);
    expect(JSON.stringify(data)).not.toContain("inquirer-synth@example.org");
  });
});

describe("rate limits remain effective", () => {
  it("donation limit (10/hr/IP) still blocks the 11th submission", async () => {
    // Use the real in-memory limiter fallback (getDb null), exactly like
    // production behavior when the DB-backed bucket cannot be used.
    fakeState.nullDb = true;
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      const r = await requestsPost(
        post({ ...validDonation(synthKey(`rl-req-${i}`)), company: "synthetic-probe" }, ip)
      );
      expect(r.status).toBe(200); // honeypot path still consumes budget
    }
    const blocked = await requestsPost(
      post({ ...validDonation(synthKey("rl-req-x")), company: "synthetic-probe" }, ip)
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).ok).toBe(false);
  });

  it("support and contact limits (20/hr/IP) still block the 21st submission", async () => {
    fakeState.nullDb = true;
    const ipS = freshIp();
    for (let i = 0; i < 20; i++) {
      const r = await supportPost(
        post({ ...validSupport(synthKey(`rl-sup-${i}`)), company: "synthetic-probe" }, ipS)
      );
      expect(r.status).toBe(200);
    }
    expect(
      (
        await supportPost(
          post({ ...validSupport(synthKey("rl-sup-x")), company: "synthetic-probe" }, ipS)
        )
      ).status
    ).toBe(429);

    const ipC = freshIp();
    for (let i = 0; i < 20; i++) {
      const r = await contactPost(
        post({ ...validContact(synthKey(`rl-con-${i}`)), company: "synthetic-probe" }, ipC)
      );
      expect(r.status).toBe(200);
    }
    expect(
      (
        await contactPost(
          post({ ...validContact(synthKey("rl-con-x")), company: "synthetic-probe" }, ipC)
        )
      ).status
    ).toBe(429);
  });
});

describe("admin export stays denied without authentication", () => {
  it("returns 401 for unauthenticated callers", async () => {
    const res = await exportGet(
      new Request("http://localhost:3000/api/admin/export?type=requests")
    );
    expect(res.status).toBe(401);
  });
});
