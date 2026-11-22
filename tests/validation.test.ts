import { describe, expect, it } from "vitest";
import { donationRequestSchema, supportOfferSchema, contactSchema, parseDateOnly } from "../lib/validation";

const base = {
  company: "",
  idempotencyKey: "abc12345",
  templeName: "Sri Test Temple",
  templeWebsite: "",
  streetAddress: "123 Temple Rd",
  addressLine2: "",
  city: "Houston",
  state: "TX",
  zipCode: "77001",
  contactName: "Jane Doe",
  contactRole: "Trustee",
  contactEmail: "jane@example.org",
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
} as const;

describe("donationRequestSchema", () => {
  it("accepts a minimal valid request", () => {
    expect(donationRequestSchema.safeParse(base).success).toBe(true);
  });
  it("requires temple name and valid ZIP", () => {
    const r = donationRequestSchema.safeParse({ ...base, templeName: "", zipCode: "bad" });
    expect(r.success).toBe(false);
  });
  it("requires phone when preferred contact is phone", () => {
    const r = donationRequestSchema.safeParse({ ...base, preferredContact: "phone", contactPhone: "" });
    expect(r.success).toBe(false);
  });
  it("requires explanation when Other is selected", () => {
    const r = donationRequestSchema.safeParse({ ...base, intendedUse: ["other"], otherUseExplanation: "" });
    expect(r.success).toBe(false);
  });
  it("rejects past dates and accepts YYYY-MM-DD only", () => {
    expect(donationRequestSchema.safeParse({ ...base, dateNeeded: "2000-01-01" }).success).toBe(false);
    expect(donationRequestSchema.safeParse({ ...base, dateNeeded: "not-a-date" }).success).toBe(false);
  });
  it("rejects quantity above the bound", () => {
    expect(donationRequestSchema.safeParse({ ...base, quantityPounds: 5000 }).success).toBe(false);
  });
  it("requires both consents", () => {
    const bad = { ...base, privacyConsent: false as unknown as true };
    expect(donationRequestSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects invalid temple website", () => {
    expect(donationRequestSchema.safeParse({ ...base, templeWebsite: "not a url" }).success).toBe(false);
  });
});

describe("support and contact schemas", () => {
  it("support requires type, message, consent", () => {
    const r = supportOfferSchema.safeParse({ company: "", idempotencyKey: "k12345678", name: "Alex Helper", email: "alex@example.org", supportType: "volunteer", message: "I can help with deliveries on weekends.", privacyConsent: true });
    expect(r.success).toBe(true);
  });
  it("contact requires subject and message length", () => {
    const r = contactSchema.safeParse({ company: "", idempotencyKey: "k12345678", name: "Alex B", email: "alex@example.org", subject: "Hi", message: "short", privacyConsent: true });
    expect(r.success).toBe(false);
  });
});

describe("parseDateOnly", () => {
  it("parses date-only without timezone shift", () => {
    const d = parseDateOnly("2026-12-25");
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(11);
    expect(d?.getUTCDate()).toBe(25);
  });
  it("returns null for invalid input", () => {
    expect(parseDateOnly("25/12/2026")).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
  });
});
