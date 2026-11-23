export const SHARE_MESSAGE_BODY =
  "Temple Initiative’s Say Yes to Vegan Sugar campaign encourages temple communities to check product-specific labeling and manufacturer information when choosing sugar for prasadam, offerings, and community meals. Learn what to look for and share the message:";

export function getSiteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost:3000";
}

export function buildShareText(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${SHARE_MESSAGE_BODY}\n\n${base}/`;
}

export function buildShareData(siteUrl: string): { title: string; text: string; url: string } {
  const base = siteUrl.replace(/\/$/, "");
  return {
    title: "Temple Initiative | Say Yes to Vegan Sugar",
    text: SHARE_MESSAGE_BODY,
    url: `${base}/`,
  };
}
