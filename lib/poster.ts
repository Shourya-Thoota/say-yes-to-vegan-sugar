export const POSTER_STEPS = [
  {
    title: "Identify the exact product and manufacturer.",
    detail: "Write down the maker, product name, and package — not just the store name.",
  },
  {
    title: "Check current product-specific processing information.",
    detail:
      "Look for product-specific vegan labeling, manufacturer information, or a relevant certification. Contact the maker when the answer is unclear.",
  },
  {
    title: "Record the product and date, and recheck if things change.",
    detail:
      "Note what you checked and when. Reconfirm when the product, packaging, supplier, or statement changes.",
  },
] as const;

export const POSTER_CAUTION =
  "Some sugar is processed using animal-derived aids. Processing varies by product and manufacturer — always check the specific package.";

export function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/$/, "");
}

export function getSiteBaseUrl(env = process.env): string {
  const configured = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost:3000";
}

export function getChoosingSugarUrl(env = process.env): string {
  return `${getSiteBaseUrl(env)}/choosing-sugar`;
}

export function getPosterUrl(env = process.env): string {
  return `${getSiteBaseUrl(env)}/poster`;
}
