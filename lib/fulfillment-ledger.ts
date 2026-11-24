import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { donationRequests, fulfillmentLedger } from "./schema";
import { reportHandledError } from "./sentry";

/**
 * Fulfillment Transparency Ledger (Part 3B, hardened) — privacy-safe read layer.
 *
 * Temple identity is consent-gated at READ time:
 * - A linked temple's name/city is shown ONLY while its current
 *   `publicListingConsent` is true AND `publicListingStatus` is "published".
 * - Otherwise (unlinked, no consent, unpublished, missing) the entry renders
 *   as "Participating Temple (STATE)" with city omitted.
 *
 * This means later unpublishing a temple automatically anonymizes its
 * historical public ledger entries. The projection below is the ONLY data
 * /sponsor may ever render. Private fields (recordedBy, internalNotes,
 * sponsorEmail, donation/sponsorship linkage IDs, temple contact data) are
 * NEVER selected into public results.
 */
export type PublicFulfillmentEntry = {
  publicRef: string;
  recipientLabel: string;
  city: string | null;
  state: string | null;
  poundsDelivered: number;
  sugarProductLabel: string;
  deliveredAt: Date;
};

type LedgerRowWithGate = {
  publicRef: string;
  storedRecipientLabel: string;
  storedCity: string | null;
  storedState: string | null;
  poundsDelivered: number;
  sugarProductLabel: string;
  deliveredAt: Date;
  linkedConsent: boolean | null;
  linkedStatus: string | null;
  linkedTempleName: string | null;
  linkedCity: string | null;
  linkedState: string | null;
};

export async function getPublicFulfillmentEntries(limit = 100): Promise<PublicFulfillmentEntry[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = (await db
      .select({
        publicRef: fulfillmentLedger.publicRef,
        storedRecipientLabel: fulfillmentLedger.recipientLabel,
        storedCity: fulfillmentLedger.city,
        storedState: fulfillmentLedger.state,
        poundsDelivered: fulfillmentLedger.poundsDelivered,
        sugarProductLabel: fulfillmentLedger.sugarProductLabel,
        deliveredAt: fulfillmentLedger.deliveredAt,
        linkedConsent: donationRequests.publicListingConsent,
        linkedStatus: donationRequests.publicListingStatus,
        linkedTempleName: donationRequests.templeName,
        linkedCity: donationRequests.city,
        linkedState: donationRequests.state,
      })
      .from(fulfillmentLedger)
      // Left join: unlinked rows keep null gate fields and anonymize.
      .leftJoin(donationRequests, eq(fulfillmentLedger.donationRequestId, donationRequests.id))
      .where(eq(fulfillmentLedger.publicVisible, true))
      .orderBy(desc(fulfillmentLedger.deliveredAt))
      .limit(Math.min(Math.max(limit, 1), 200))) as LedgerRowWithGate[];
    return rows.map(toPublicEntry);
  } catch {
    reportHandledError("fulfillment_ledger_read", "/sponsor");
    throw new Error("Fulfillment ledger unavailable.");
  }
}

/** Map one joined row through the consent gate. Never leaks linkage IDs. */
export function toPublicEntry(row: LedgerRowWithGate): PublicFulfillmentEntry {
  const gated =
    row.linkedConsent === true &&
    row.linkedStatus === "published" &&
    (row.linkedTempleName ?? "").trim().length > 0;
  if (gated) {
    return {
      publicRef: row.publicRef,
      recipientLabel: (row.linkedTempleName as string).trim().slice(0, 200),
      city: (row.linkedCity ?? "").trim() || null,
      state: ((row.linkedState ?? "").trim().toUpperCase() || row.storedState) as string | null,
      poundsDelivered: row.poundsDelivered,
      sugarProductLabel: row.sugarProductLabel,
      deliveredAt: row.deliveredAt,
    };
  }
  // Anonymized: omit city so a temple cannot be re-identified.
  const s = (row.storedState ?? row.linkedState ?? "").trim().toUpperCase();
  return {
    publicRef: row.publicRef,
    recipientLabel: anonymizedRecipientLabel(/^[A-Z]{2}$/.test(s) ? s : null),
    city: null,
    state: /^[A-Z]{2}$/.test(s) ? s : null,
    poundsDelivered: row.poundsDelivered,
    sugarProductLabel: row.sugarProductLabel,
    deliveredAt: row.deliveredAt,
  };
}

export type FulfillmentTotals = { totalPounds: number; totalDeliveries: number };

export async function getPublicFulfillmentTotals(): Promise<FulfillmentTotals> {
  const db = getDb();
  if (!db) return { totalPounds: 0, totalDeliveries: 0 };
  try {
    const [row] = await db
      .select({
        totalPounds: sql<number>`coalesce(sum(${fulfillmentLedger.poundsDelivered}), 0)::int`,
        totalDeliveries: sql<number>`count(*)::int`,
      })
      .from(fulfillmentLedger)
      .where(eq(fulfillmentLedger.publicVisible, true));
    return {
      totalPounds: Number(row?.totalPounds ?? 0),
      totalDeliveries: Number(row?.totalDeliveries ?? 0),
    };
  } catch {
    reportHandledError("fulfillment_ledger_read", "/sponsor");
    throw new Error("Fulfillment ledger unavailable.");
  }
}

/** Placeholder used when a temple did not opt into public listing. */
export function anonymizedRecipientLabel(state: string | null | undefined): string {
  const s = (state ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(s)) return `Participating Temple (${s})`;
  return "Participating Temple";
}

// Re-export for tests that assert the exact public key set.
export const PUBLIC_FULFILLMENT_KEYS = [
  "publicRef",
  "recipientLabel",
  "city",
  "state",
  "poundsDelivered",
  "sugarProductLabel",
  "deliveredAt",
] as const;

export async function countPublicFulfillmentEntries(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(fulfillmentLedger)
      .where(eq(fulfillmentLedger.publicVisible, true));
    return n;
  } catch {
    reportHandledError("fulfillment_ledger_read", "/sponsor");
    throw new Error("Fulfillment ledger unavailable.");
  }
}

/**
 * Strict delivery-date parser. Accepts YYYY-MM-DD (UTC noon) or full ISO
 * timestamps. Rejects impossible dates such as 2026-02-30 instead of
 * allowing JavaScript date rollover.
 */
export function toSafeDeliveredDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Strict YYYY-MM-DD: verify components round-trip.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    if (Number.isNaN(dt.getTime())) return null;
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
