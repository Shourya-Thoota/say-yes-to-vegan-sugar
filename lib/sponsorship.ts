// Part 3B: fixed server-side sponsorship tiers. Prices are NEVER accepted
// from the client — the tier code is the only client input, and the amount
// is resolved here on the server.
export const SPONSORSHIP_TIERS = {
  bag_10: { code: "bag_10", label: "10 lb bag", amountCents: 1500, estimatedPounds: 10 },
  bag_25: { code: "bag_25", label: "25 lb bag", amountCents: 3500, estimatedPounds: 25 },
  bag_50: { code: "bag_50", label: "50 lb bag", amountCents: 6500, estimatedPounds: 50 },
  bag_100: { code: "bag_100", label: "100 lb bag", amountCents: 12500, estimatedPounds: 100 },
} as const;

export type SponsorshipTierCode = keyof typeof SPONSORSHIP_TIERS;

export const SPONSORSHIP_TIER_CODES = Object.keys(SPONSORSHIP_TIERS) as SponsorshipTierCode[];

export function getSponsorshipTier(code: string | null | undefined) {
  if (!code) return null;
  const tier = (SPONSORSHIP_TIERS as Record<string, (typeof SPONSORSHIP_TIERS)[SponsorshipTierCode]>)[code];
  return tier ?? null;
}

export function isSponsorshipTierCode(code: unknown): code is SponsorshipTierCode {
  return typeof code === "string" && code in SPONSORSHIP_TIERS;
}

export const SPONSOR_DISPLAY_NAME_MAX_LENGTH = 80;

/**
 * Plain-text sponsor display name. Collapses whitespace/newlines, trims,
 * strips control characters, and bounds length. Returns null for empty.
 */
export function sanitizeSponsorDisplayName(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const collapsed = value.replace(/[\r\n\t]+/g, " ").replace(/[\u0000-\u001F\u007F]/g, "").trim().replace(/\s{2,}/g, " ");
  if (!collapsed) return null;
  return collapsed.slice(0, SPONSOR_DISPLAY_NAME_MAX_LENGTH);
}

/** Display formatters (server + client safe, no PII). */
export function formatCentsUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
