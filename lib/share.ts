export const SHARE_MESSAGE_BODY =
  "Temple Initiative’s Say Yes to Vegan Sugar campaign encourages temple communities to check product-specific labeling and manufacturer information when choosing sugar for prasadam, offerings, and community meals. Learn what to look for and share the message:";

export function getSiteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost:3000";
}

export type ShareLanguageCode = "en" | "hi" | "te" | "ta" | "gu";

export type ShareLanguage = {
  code: ShareLanguageCode;
  label: string;
  nativeLabel: string;
  /** Only reviewed languages may appear in the public UI. */
  reviewed: boolean;
};

// Language infrastructure for English, Hindi, Telugu, Tamil, Gujarati.
// Publication gating: only languages with reviewed: true are exposed in the
// public UI. Candidate translations for unreviewed languages live only in
// docs/share-translations-review.md until qualified review is complete.
export const SHARE_LANGUAGES: ShareLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", reviewed: true },
  { code: "hi", label: "Hindi", nativeLabel: "\u0939\u093f\u0928\u094d\u0926\u0940", reviewed: false },
  { code: "te", label: "Telugu", nativeLabel: "\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41", reviewed: false },
  { code: "ta", label: "Tamil", nativeLabel: "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd", reviewed: false },
  { code: "gu", label: "Gujarati", nativeLabel: "\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0", reviewed: false },
];

export const PUBLISHED_SHARE_LANGUAGES: ShareLanguage[] = SHARE_LANGUAGES.filter((l) => l.reviewed);

export function isPublishedShareLanguage(code: string): code is "en" {
  return PUBLISHED_SHARE_LANGUAGES.some((l) => l.code === code);
}

export function getShareMessageForLanguage(code: string): string {
  // Only English is published today. Unknown or pending-review codes fall back
  // to English explicitly rather than silently rendering a different language.
  void code;
  return SHARE_MESSAGE_BODY;
}

export function buildShareText(siteUrl: string, languageCode = "en"): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${getShareMessageForLanguage(languageCode)}\n\n${base}/`;
}

export function buildShareData(siteUrl: string): { title: string; text: string; url: string } {
  const base = siteUrl.replace(/\/$/, "");
  return {
    title: "Temple Initiative | Say Yes to Vegan Sugar",
    text: SHARE_MESSAGE_BODY,
    url: `${base}/`,
  };
}
