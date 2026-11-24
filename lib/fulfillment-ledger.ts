import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { fulfillmentLedger } from "./schema";
import { reportHandledError } from "./sentry";

/**
 * Fulfillment Transparency Ledger (Part 3B) — privacy-safe read layer.
 *
 * The projection below is the ONLY data /sponsor may ever render for
 * deliveries. Private fields (recordedBy, internalNotes, sponsorEmail,
 * donation/sponsorship linkage, temple contact data) are NEVER selected,
 * returned, or passed to any client component or public response.
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

export async function getPublicFulfillmentEntries(limit = 100): Promise<PublicFulfillmentEntry[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        publicRef: fulfillmentLedger.publicRef,
        recipientLabel: fulfillmentLedger.recipientLabel,
        city: fulfillmentLedger.city,
        state: fulfillmentLedger.state,
        poundsDelivered: fulfillmentLedger.poundsDelivered,
        sugarProductLabel: fulfillmentLedger.sugarProductLabel,
        deliveredAt: fulfillmentLedger.deliveredAt,
      })
      .from(fulfillmentLedger)
      .where(eq(fulfillmentLedger.publicVisible, true))
      .orderBy(desc(fulfillmentLedger.deliveredAt))
      .limit(Math.min(Math.max(limit, 1), 200));
    return rows;
  } catch {
    reportHandledError("fulfillment_ledger_read", "/sponsor");
    throw new Error("Fulfillment ledger unavailable.");
  }
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

export function toSafeDeliveredDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD (date-only, UTC midnight) or full ISO timestamps.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}


