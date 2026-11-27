/**
 * Route-level tests for fail-closed behavior. These run without DATABASE_URL,
 * so getDb() returns null — exactly the misconfigured/DB-down state.
 * They verify: invalid input is rejected, missing DB never yields success,
 * honeypots do not persist, rate limits trigger across requests, and the
 * admin export rejects unauthenticated callers and fails closed without a DB.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST as requestsPost } from "../app/api/requests/route";
import { POST as supportPost } from "../app/api/support/route";
import { POST as contactPost } from "../app/api/contact/route";
import { GET as readyGet } from "../app/api/ready/route";
import { GET as healthGet } from "../app/api/health/route";
import { checkRateLimit } from "../lib/rate-limit";
import { getDb } from "../lib/db";

const adminState = vi.hoisted(() => ({ admin: null as { email: string } | null }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => adminState.admin,
}));
import { GET as exportGet } from "../app/api/admin/export/route";

function post(body: unknown, ip: string) {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const validRequest = {
  idempotencyKey: "route-test-key-0001",
  templeName: "Sri Route Test Temple",
  streetAddress: "1 Temple Road",
  city: "Houston",
  state: "TX",
  zipCode: "77001",
  contactName: "Jane Doe",
  contactRole: "Trustee",
  contactEmail: "jane@example.org",
  preferredContact: "email",
  authorized: true,
  quantityPounds: 50,
  intendedUse: ["prasadam"],
  understandsNoGuarantee: true,
  privacyConsent: true,
};

beforeEach(() => {
  delete process.env.DATABASE_URL;
  adminState.admin = null;
});

describe("public submission APIs without a database", () => {
  it("rejects invalid donation requests with 422", async () => {
    const res = await requestsPost(post({ idempotencyKey: "short" }, "10.1.0.1"));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("never reports success when the database is unavailable (503, ok:false)", async () => {
    const res = await requestsPost(post(validRequest, "10.1.0.2"));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.errors?._form).toBeTruthy();
  });

  it("support and contact also fail closed without a database", async () => {
    const s = await supportPost(
      post({ idempotencyKey: "route-test-key-0002", name: "Sam Helper", email: "sam@example.org", supportType: "volunteer", message: "I can help coordinate deliveries.", privacyConsent: true }, "10.1.0.3")
    );
    expect(s.status).toBe(503);
    expect((await s.json()).ok).toBe(false);

    const c = await contactPost(
      post({ idempotencyKey: "route-test-key-0003", name: "Pat Question", email: "pat@example.org", subject: "Question", message: "Is the sugar really vegan?", privacyConsent: true }, "10.1.0.4")
    );
    expect(c.status).toBe(503);
    expect((await c.json()).ok).toBe(false);
  });

  it("honeypot submissions look successful without persisting anything", async () => {
    const res = await requestsPost(post({ ...validRequest, company: "spam-bot" }, "10.1.0.5"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, ref: "SVS-0000-0000", message: "Received." });
  });

  it("rate limit triggers after 10 donation submissions from one IP", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await requestsPost(post({ ...validRequest, company: "spam-probe" }, "10.1.0.6"));
      expect(res.status).toBe(200); // honeypot 200s still consume budget
    }
    const blocked = await requestsPost(post({ ...validRequest, company: "spam-probe" }, "10.1.0.6"));
    expect(blocked.status).toBe(429);
    const data = await blocked.json();
    expect(data.ok).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks with a retry hint", async () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    expect((await checkRateLimit(getDb(), key, 2, 60)).allowed).toBe(true);
    expect((await checkRateLimit(getDb(), key, 2, 60)).allowed).toBe(true);
    const third = await checkRateLimit(getDb(), key, 2, 60);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("health and readiness", () => {
  it("health is 200 without touching the database", async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("ready is 503 when no database is configured", async () => {
    const res = await readyGet();
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe("not_ready");
  });
});

describe("admin export", () => {
  it("rejects unauthenticated callers with 401", async () => {
    const res = await exportGet(new Request("http://localhost:3000/api/admin/export?type=requests"));
    expect(res.status).toBe(401);
  });

  it("fails closed with 503 for admins when the database is unavailable", async () => {
    adminState.admin = { email: "admin@example.org" };
    const res = await exportGet(new Request("http://localhost:3000/api/admin/export?type=requests"));
    expect(res.status).toBe(503);
  });
});
