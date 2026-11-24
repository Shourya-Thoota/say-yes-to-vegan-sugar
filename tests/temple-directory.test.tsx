/**
 * Part 3A unit coverage: privacy boundary, server-side enforcement,
 * safe URL handling, and directory rendering.
 *
 * Real-PostgreSQL coverage (migration, opt-in, publish/unpublish, filtering,
 * PII exclusion) lives in tests/public-directory-pg.test.ts and runs in CI.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { donationRequests, requestNotes, rateLimits, statusHistory } from "../lib/schema";

// ---------------------------------------------------------------------------
// In-memory fake DB for the request route + admin listing actions.
// ---------------------------------------------------------------------------
const dirState = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  byKey: new Map<string, string>(),
  notes: [] as Record<string, unknown>[],
  buckets: [] as { key: string; windowStart: Date; count: number }[],
  idCounter: 0,
}));

function windowOf(v: unknown): number {
  const d = v instanceof Date ? v : new Date(String(v));
  return d.getTime();
}

function rateLimitLookup(cond: unknown): Record<string, unknown>[] {
  const c = cond as { __testAnd?: boolean; conds?: unknown[] } | null;
  let keyVal: string | null = null;
  let windowVal: unknown = null;
  const parts = c && (c as { __testAnd?: boolean }).__testAnd
    ? (c as { __testAnd: boolean; conds: unknown[] }).conds ?? []
    : [cond];
  for (const p of parts) {
    const q = p as { __testEq?: boolean; __testGte?: boolean; column?: unknown; value?: unknown };
    if (q && q.__testEq && q.column === rateLimits.key) keyVal = String(q.value);
    if (q && (q.__testEq || q.__testGte) && q.column === rateLimits.windowStart) windowVal = q.value;
  }
  if (keyVal === null || windowVal === null) return [];
  const w = windowOf(windowVal);
  return dirState.buckets
    .filter((b) => b.key === keyVal && b.windowStart.getTime() >= w)
    .map((b) => ({ ...b }));
}

function donationLookup(cond: unknown): Record<string, unknown>[] {
  const c = cond as { __testEq?: boolean; column?: unknown; value?: unknown } | null;
  if (!c || c.__testEq !== true) return [...dirState.rows.values()];
  if (c.column === donationRequests.idempotencyKey) {
    const id = dirState.byKey.get(String(c.value ?? ""));
    const row = id ? dirState.rows.get(id) : undefined;
    return row ? [{ publicRef: row.publicRef }] : [];
  }
  if (c.column === donationRequests.id) {
    const row = dirState.rows.get(String(c.value ?? ""));
    return row ? [row] : [];
  }
  return [];
}

function execInsert(table: unknown, data: Record<string, unknown>): unknown {
  if (table === rateLimits) {
    dirState.buckets.push({
      key: String(data.key),
      windowStart: data.windowStart instanceof Date ? data.windowStart : new Date(String(data.windowStart)),
      count: Number(data.count ?? 1),
    });
    return [];
  }
  if (table === requestNotes || table === statusHistory) {
    dirState.notes.push({ ...data });
    return [];
  }
  if (table !== donationRequests) throw new Error("unknown table (test fake)");
  const k = String(data.idempotencyKey ?? "");
  if (dirState.byKey.has(k)) {
    throw new Error('duplicate key value violates unique constraint "test_idempotency_key_uidx"');
  }
  dirState.idCounter += 1;
  const id = `test-id-${dirState.idCounter}`;
  const row: Record<string, unknown> = { id, ...data };
  dirState.rows.set(id, row);
  if (k) dirState.byKey.set(k, id);
  return [{ id: row.id, publicRef: row.publicRef }];
}

const fakeDb: {
  select: (_fields?: unknown) => {
    from: (table: unknown) => {
      where: (cond: unknown) => { limit: (n: number) => Promise<Record<string, unknown>[]> };
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
      // biome-ignore lint: test fake where shape
      where: (cond: unknown) => Promise<unknown[]>;
    };
  };
  transaction: <T>(fn: (tx: typeof fakeDb) => Promise<T>) => Promise<T>;
} = {
  select: (_fields?: unknown) => ({
    from: (table: unknown) => ({
      where: (cond: unknown) => ({
        limit: async (_n: number) => {
          if (table === rateLimits) return rateLimitLookup(cond);
          if (table === donationRequests) return donationLookup(cond);
          return [];
        },
      }),
    }),
  }),
  insert: (table: unknown) => ({
    values: (data: Record<string, unknown>) => ({
      then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(execInsert(table, data)).then(resolve, reject),
      returning: () => Promise.resolve(execInsert(table, data)),
    }),
  }),
  update: (table: unknown) => ({
    set: (data: Record<string, unknown>) => ({
      where: async (cond: unknown) => {
        if (table === rateLimits) {
          for (const b of rateLimitLookup(cond)) {
            const target = dirState.buckets.find((r) => r.key === (b as { key: string }).key);
            if (target) target.count += 1;
          }
          return [];
        }
        if (table === donationRequests) {
          const c = cond as { __testEq?: boolean; column?: unknown; value?: unknown } | null;
          if (c && c.__testEq === true && c.column === donationRequests.id) {
            const row = dirState.rows.get(String(c.value ?? ""));
            if (row) Object.assign(row, data);
          }
          return [];
        }
        return [];
      },
    }),
  }),
  transaction: async <T,>(fn: (tx: typeof fakeDb) => Promise<T>): Promise<T> => fn(fakeDb),
};

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
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const authState = vi.hoisted(() => ({ admin: null as { email: string } | null }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => authState.admin,
}));

const dirMock = vi.hoisted(() => ({ listings: [] as unknown[], total: 0 }));
vi.mock("@/lib/public-directory", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/public-directory")>();
  const { vi: mockVi } = await import("vitest");
  return {
    ...mod,
    getPublishedTemples: mockVi.fn(async () => dirMock.listings),
    countPublishedTemples: mockVi.fn(async () => dirMock.total),
  };
});

import { POST as requestsPost } from "../app/api/requests/route";
import { updatePublicListing } from "../lib/admin-actions";
import { donationRequestSchema } from "../lib/validation";
import { sanitizeListingSummary, toSafeHttpUrl } from "../lib/public-directory";
import TemplesPage from "../app/temples/page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let keyCounter = 0;
function synthKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-dir-${Date.now().toString(36)}-${keyCounter}`.slice(0, 64);
}
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.98.${Math.floor(ipCounter / 250) + 1}.${(ipCounter % 250) + 1}`;
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
    templeName: "Synthetic Directory Temple",
    templeWebsite: "",
    streetAddress: "1 Synthetic Way",
    addressLine2: "",
    city: "Houston",
    state: "TX",
    zipCode: "77001",
    contactName: "Synthetic Person",
    contactRole: "Trustee",
    contactEmail: "synthetic-dir@example.org",
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

beforeEach(() => {
  authState.admin = null;
});

afterEach(() => {
  dirState.rows.clear();
  dirState.byKey.clear();
  dirState.notes.length = 0;
  dirState.buckets.length = 0;
  dirMock.listings = [];
  dirMock.total = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("safe website URL handling", () => {
  it("accepts http(s) URLs and rejects javascript:, data:, and malformed schemes", () => {
    expect(toSafeHttpUrl("https://temple.org")).toContain("https://temple.org");
    expect(toSafeHttpUrl("http://temple.org/visit")).toContain("http://temple.org/visit");
    expect(toSafeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(toSafeHttpUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(toSafeHttpUrl("data:text/html,<h1>x</h1>")).toBeNull();
    expect(toSafeHttpUrl("ftp://temple.org")).toBeNull();
    expect(toSafeHttpUrl("not a url")).toBeNull();
    expect(toSafeHttpUrl("")).toBeNull();
    expect(toSafeHttpUrl(null)).toBeNull();
    expect(toSafeHttpUrl(undefined)).toBeNull();
  });
});

describe("listing summary sanitizer", () => {
  it("collapses whitespace, drops empties, and bounds length at 240", () => {
    expect(sanitizeListingSummary(null)).toBeNull();
    expect(sanitizeListingSummary("   ")).toBeNull();
    expect(sanitizeListingSummary("Line one\nline two")).toBe("Line one line two");
    expect(sanitizeListingSummary("x".repeat(300))).toBe("x".repeat(240));
    expect(sanitizeListingSummary("  trimmed  ")).toBe("trimmed");
  });
});

describe("request validation opt-in", () => {
  it("defaults consent to false and strips injected listing status", () => {
    const base = validDonation(synthKey("v")) as Record<string, unknown>;
    const { publicListingConsent: _drop, ...withoutConsent } = base;
    expect(_drop).toBeUndefined();
    const parsed = donationRequestSchema.safeParse(withoutConsent);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.publicListingConsent).toBe(false);

    const injected = {
      ...base,
      publicListingConsent: true,
      // A hostile client cannot self-publish: unknown keys are stripped.
      publicListingStatus: "published",
      publicListingSummary: "Hacked note",
    };
    const parsed2 = donationRequestSchema.safeParse(injected);
    expect(parsed2.success).toBe(true);
    if (parsed2.success) {
      expect(parsed2.data.publicListingConsent).toBe(true);
      expect(parsed2.data).not.toHaveProperty("publicListingStatus");
      expect(parsed2.data).not.toHaveProperty("publicListingSummary");
    }
  });
});

describe("public request submission can never self-publish", () => {
  it("consent=true stores pending_review, never published", async () => {
    const key = synthKey("optin");
    const res = await requestsPost(post(validDonation(key, { publicListingConsent: true }), freshIp()));
    expect(res.status).toBe(201);
    const row = [...dirState.rows.values()].find((r) => r.idempotencyKey === key);
    expect(row).toBeTruthy();
    expect(row!.publicListingConsent).toBe(true);
    expect(row!.publicListingConsentAt).toBeInstanceOf(Date);
    expect(row!.publicListingStatus).toBe("pending_review");
    expect(row!.publicListingStatus).not.toBe("published");
  });

  it("omitted consent stores private with null consent timestamp", async () => {
    const key = synthKey("noopt");
    const full = validDonation(key) as Record<string, unknown>;
    const { publicListingConsent: _drop2, ...body } = full;
    expect(_drop2).toBeUndefined();
    const res = await requestsPost(post(body, freshIp()));
    expect(res.status).toBe(201);
    const row = [...dirState.rows.values()].find((r) => r.idempotencyKey === key);
    expect(row!.publicListingConsent).toBe(false);
    expect(row!.publicListingConsentAt).toBeNull();
    expect(row!.publicListingStatus).toBe("private");
  });

  it("injected published status is ignored", async () => {
    const key = synthKey("inject");
    const res = await requestsPost(
      post(
        { ...validDonation(key, { publicListingConsent: true }), publicListingStatus: "published", publicListingSummary: "Hacked" } as Record<string, unknown>,
        freshIp()
      )
    );
    expect(res.status).toBe(201);
    const row = [...dirState.rows.values()].find((r) => r.idempotencyKey === key);
    expect(row!.publicListingStatus).toBe("pending_review");
    expect(row!.publicListingSummary ?? null).toBeNull();
  });
});

describe("admin listing moderation dual gate", () => {
  function seedRow(overrides: Record<string, unknown> = {}) {
    dirState.idCounter += 1;
    const id = `test-id-${dirState.idCounter}`;
    const row: Record<string, unknown> = {
      id,
      idempotencyKey: synthKey("seed"),
      publicRef: "SVS-SEED-0001",
      templeName: "Seed Temple",
      publicListingConsent: true,
      publicListingConsentAt: new Date(),
      publicListingStatus: "pending_review",
      publicListingSummary: null,
      publicListingReviewedBy: null,
      publicListingReviewedAt: null,
      ...overrides,
    };
    dirState.rows.set(id, row);
    return row;
  }

  function formData(action: string, summary = ""): FormData {
    const fd = new FormData();
    fd.set("action", action);
    fd.set("summary", summary);
    return fd;
  }

  it("rejects publishing a request that did not opt in", async () => {
    authState.admin = { email: "admin@example.org" };
    const row = seedRow({ publicListingConsent: false, publicListingStatus: "private" });
    await expect(updatePublicListing(row.id as string, formData("publish"))).rejects.toThrow(
      /did not opt in/i
    );
    expect(dirState.rows.get(row.id as string)!.publicListingStatus).toBe("private");
  });

  it("rejects unauthenticated listing changes", async () => {
    const row = seedRow();
    await expect(updatePublicListing(row.id as string, formData("publish"))).rejects.toThrow(
      /unauthorized/i
    );
  });

  it("publishes an opted-in request with reviewer audit trail", async () => {
    authState.admin = { email: "admin@example.org" };
    const row = seedRow();
    await updatePublicListing(row.id as string, formData("publish", "Using vegan sugar for prasad"));
    const updated = dirState.rows.get(row.id as string)!;
    expect(updated.publicListingStatus).toBe("published");
    expect(updated.publicListingSummary).toBe("Using vegan sugar for prasad");
    expect(updated.publicListingReviewedBy).toBe("admin@example.org");
    expect(updated.publicListingReviewedAt).toBeInstanceOf(Date);
    expect(dirState.notes.length).toBe(1);
    expect(dirState.notes[0].requestId).toBe(row.id);
  });

  it("unpublishes immediately and rejects over-long summaries", async () => {
    authState.admin = { email: "admin@example.org" };
    const row = seedRow({ publicListingStatus: "published" });
    await updatePublicListing(row.id as string, formData("unpublish"));
    const updated = dirState.rows.get(row.id as string)!;
    expect(updated.publicListingStatus).toBe("unpublished");

    const row2 = seedRow();
    await expect(
      updatePublicListing(row2.id as string, formData("publish", "x".repeat(241)))
    ).rejects.toThrow(/240/i);
    expect(dirState.rows.get(row2.id as string)!.publicListingStatus).toBe("pending_review");
  });
});

describe("/temples page", () => {
  it("shows a dignified empty state with request and guide links", async () => {
    dirMock.listings = [];
    dirMock.total = 0;
    const node = await TemplesPage({ searchParams: Promise.resolve({}) });
    render(node);
    expect(screen.getByRole("heading", { name: /temple directory/i })).toBeTruthy();
    expect(screen.getByText(/no temples are listed yet/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /request sugar/i })).toHaveProperty(
      "href",
      expect.stringContaining("/request-sugar")
    );
    expect(screen.getByRole("link", { name: /choosing-sugar guide/i })).toHaveProperty(
      "href",
      expect.stringContaining("/choosing-sugar")
    );
    expect(screen.getByText(/not a certification/i)).toBeTruthy();
  });

  it("renders only safe fields, linkifies https, and never renders javascript: links", async () => {
    dirMock.total = 2;
    dirMock.listings = [
      {
        publicRef: "SVS-AAAA-1111",
        templeName: "Good Temple",
        city: "Houston",
        state: "TX",
        templeWebsite: "https://good-temple.example.org",
        publicListingSummary: "Using vegan sugar for prasad.",
        publicListingReviewedAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        publicRef: "SVS-BBBB-2222",
        templeName: "Tricky Temple",
        city: "Austin",
        state: "TX",
        templeWebsite: "javascript:alert(1)",
        publicListingSummary: null,
        publicListingReviewedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    const node = await TemplesPage({ searchParams: Promise.resolve({}) });
    const { container } = render(node);
    expect(screen.getByText("Good Temple")).toBeTruthy();
    expect(screen.getByText("Tricky Temple")).toBeTruthy();
    const safeLink = screen.getByRole("link", { name: /visit website/i });
    expect(safeLink.getAttribute("href")).toBe("https://good-temple.example.org/");
    expect(safeLink.getAttribute("rel")).toContain("noopener");
    expect(safeLink.getAttribute("target")).toBe("_blank");
    // The hostile website must not appear as any link.
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.startsWith("javascript:"))).toBe(false);
    // No PII is rendered: the mocked listings carry none, and the page
    // renders only name/city/state/website/summary.
    expect(container.textContent).not.toContain("synthetic-dir@example.org");
  });

  it("shows a no-match state when filters exclude everything", async () => {
    dirMock.total = 3;
    dirMock.listings = [];
    const node = await TemplesPage({ searchParams: Promise.resolve({ state: "CA", q: "zzz" }) });
    render(node);
    expect(screen.getByText(/no temples match this search/i)).toBeTruthy();
  });

  it("degrades gracefully when the directory query rejects (DB outage)", async () => {
    const pubDir = await import("@/lib/public-directory");
    vi.mocked(pubDir.getPublishedTemples).mockRejectedValueOnce(
      new Error("Temple directory unavailable.")
    );
    const node = await TemplesPage({ searchParams: Promise.resolve({}) });
    const { container } = render(node);
    // Calm, accessible notice instead of a 500.
    expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    // Disclaimer and navigation stay intact.
    expect(screen.getByText(/not a certification/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /temple directory/i })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Temple directory unavailable\./);
  });
});
