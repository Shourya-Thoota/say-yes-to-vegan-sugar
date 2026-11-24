import { describe, expect, it } from "vitest";
import {
  PUBLISHED_SHARE_LANGUAGES,
  SHARE_LANGUAGES,
  buildShareText,
  getShareMessageForLanguage,
  isPublishedShareLanguage,
} from "../lib/share";

const SITE = "https://say-yes-to-vegan-sugar-production.up.railway.app";

describe("share language publication gating", () => {
  it("publishes only reviewed languages today", () => {
    expect(PUBLISHED_SHARE_LANGUAGES.map((l) => l.code)).toEqual(["en"]);
    for (const lang of SHARE_LANGUAGES) {
      if (lang.code !== "en") expect(lang.reviewed).toBe(false);
    }
  });

  it("infrastructure covers five languages with native-script labels", () => {
    expect(SHARE_LANGUAGES.map((l) => l.code).sort()).toEqual(["en", "gu", "hi", "ta", "te"]);
    for (const lang of SHARE_LANGUAGES) {
      expect(lang.nativeLabel.trim().length).toBeGreaterThan(0);
      expect(lang.label.trim().length).toBeGreaterThan(0);
    }
    // Native-script spot checks (not translations of the message itself).
    expect(SHARE_LANGUAGES.find((l) => l.code === "hi")?.nativeLabel).toContain("हिन्दी");
    expect(SHARE_LANGUAGES.find((l) => l.code === "te")?.nativeLabel).toContain("తెలుగు");
  });

  it("falls back to English for unreviewed or unknown codes", () => {
    const english = getShareMessageForLanguage("en");
    expect(getShareMessageForLanguage("hi")).toBe(english);
    expect(getShareMessageForLanguage("xx")).toBe(english);
    expect(isPublishedShareLanguage("hi")).toBe(false);
    expect(isPublishedShareLanguage("en")).toBe(true);
  });

  it("appends the production URL consistently for the selected language", () => {
    const text = buildShareText(`${SITE}/`, "en");
    expect(text.endsWith(`${SITE}/`)).toBe(true);
    expect(text).toContain("Temple Initiative");
    expect(text).toMatch(/some sugar|product-specific/i);
    expect(text).not.toMatch(/shame|guarantee|miracle|certified/i);
  });
});
