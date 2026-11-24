import { describe, expect, it } from "vitest";
import {
  buildInquiryDraft,
  buildInquiryMailto,
  buildInquirySubject,
  sanitizeInquiryFields,
  EMPTY_INQUIRY_FIELDS,
  INQUIRY_LIMITS,
} from "../lib/inquiry";

const GUIDE = "https://say-yes-to-vegan-sugar-production.up.railway.app/choosing-sugar";

describe("inquiry draft", () => {
  it("produces a useful generic draft with blank fields", () => {
    const draft = buildInquiryDraft(EMPTY_INQUIRY_FIELDS, GUIDE);
    expect(draft).toMatch(/bone char/);
    expect(draft).toMatch(/facility, supplier, region, or lot/);
    expect(draft).toMatch(/package markings/);
    expect(draft).toMatch(/written documentation/);
    expect(draft).toContain(GUIDE);
    expect(draft).toMatch(/\[exact product name\]/);
  });

  it("includes filled fields as text", () => {
    const draft = buildInquiryDraft(
      { ...EMPTY_INQUIRY_FIELDS, brand: "Example Mill", productName: "Granulated Sugar", packageSize: "4 lb" },
      GUIDE
    );
    expect(draft).toContain("Example Mill");
    expect(draft).toContain("Granulated Sugar");
    expect(draft).toContain("4 lb");
  });

  it("handles punctuation, unicode, and multiline input without HTML", () => {
    const fields = sanitizeInquiryFields({
      brand: "Müller & Sons — “temple” <sugar>",
      productName: "Line one\nLine two",
      packageSize: "4 lb (1.81 kg) — ok?",
    });
    const draft = buildInquiryDraft(fields, GUIDE);
    expect(draft).toContain("Müller & Sons");
    expect(draft).not.toContain("\nLine two");
    expect(draft).not.toMatch(/<script|&lt;|&#/);
  });

  it("bounds reasonable input lengths", () => {
    const long = "x".repeat(500);
    const clean = sanitizeInquiryFields({ ...EMPTY_INQUIRY_FIELDS, brand: long });
    expect(clean.brand.length).toBeLessThanOrEqual(INQUIRY_LIMITS.brand);
    const draft = buildInquiryDraft({ ...EMPTY_INQUIRY_FIELDS, brand: long }, GUIDE);
    expect(draft).not.toContain(long);
  });

  it("builds an encoded mailto with no invented recipient and no auto-send", () => {
    const mailto = buildInquiryMailto(
      { ...EMPTY_INQUIRY_FIELDS, productName: "Granulated Sugar & Co." },
      GUIDE
    );
    expect(mailto.startsWith("mailto:?")).toBe(true);
    expect(mailto).not.toMatch(/mailto:[^?]/);
    const url = new URL(mailto);
    const subject = url.searchParams.get("subject") ?? "";
    const body = url.searchParams.get("body") ?? "";
    expect(subject).toContain("Granulated Sugar & Co.");
    expect(body).toMatch(/bone char/);
    expect(body).toContain(GUIDE);
  });

  it("subject falls back to a generic question when blank", () => {
    expect(buildInquirySubject(EMPTY_INQUIRY_FIELDS)).toMatch(/sugar processing aids/i);
  });
});
