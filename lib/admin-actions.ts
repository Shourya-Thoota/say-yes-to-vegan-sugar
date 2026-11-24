"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  donationRequests,
  fulfillmentLedger,
  requestNotes,
  sponsorshipOrders,
  statusHistory,
  PUBLIC_LISTING_SUMMARY_MAX_LENGTH,
  type PublicListingStatus,
} from "./schema";
import { requireAdmin } from "./auth";
import { adminListingActionSchema, adminListingSummarySchema, adminNoteSchema, adminStatusSchema, fulfillmentEntrySchema, fulfillmentVisibilitySchema } from "./validation";
import { anonymizedRecipientLabel, toSafeDeliveredDate } from "./fulfillment-ledger";
import { sanitizeListingSummary } from "./public-directory";
import { getServerConfig } from "./config";
import { generatePublicRef } from "./reference";
import { captureVerificationEvent, reportHandledError } from "./sentry";

export async function updateRequestStatus(requestId: string, formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const parsed = adminStatusSchema.safeParse({
    status: formData.get("status"),
    deliveryNotes: formData.get("deliveryNotes") ?? "",
  });
  if (!parsed.success) throw new Error("Invalid status update.");
  const db = getDb();
  if (!db) throw new Error("Database unavailable.");

  const current = await db.select().from(donationRequests).where(eq(donationRequests.id, requestId)).limit(1);
  if (current.length === 0) throw new Error("Request not found.");
  const fromStatus = current[0].status;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(donationRequests)
        .set({ status: parsed.data.status, deliveryNotes: parsed.data.deliveryNotes || null, updatedAt: new Date() })
        .where(eq(donationRequests.id, requestId));
      await tx.insert(statusHistory).values({
        requestId,
        fromStatus,
        toStatus: parsed.data.status,
        changedBy: admin.email,
      });
    });
  } catch {
    // Fixed message + safe tags only; the DB error is never forwarded. Throw
    // a new generic error so automatic capture can only ever see safe text.
    reportHandledError("admin_request_status_update");
    throw new Error("Status update failed.");
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/requests/${requestId}`);
}

/**
 * Part 3A: moderate the optional public-directory listing for a request.
 *
 * Dual gate enforced server-side:
 *   1. `publish` requires explicit opt-in consent (`publicListingConsent`).
 *      Requests that did not opt in are rejected — they can never appear
 *      on /temples.
 *   2. Only an authenticated admin (requireAdmin) can publish/unpublish.
 *
 * `unpublish` removes the temple from the public directory immediately
 * while preserving the original opt-in consent record.
 * Every change records reviewer + timestamp and writes an admin-only audit
 * note (never exposed publicly, never alters request status history).
 */
export async function updatePublicListing(requestId: string, formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const parsedAction = adminListingActionSchema.safeParse({ action: formData.get("action") });
  if (!parsedAction.success) throw new Error("Invalid listing action.");
  const parsedSummary = adminListingSummarySchema.safeParse({ summary: formData.get("summary") ?? "" });
  if (!parsedSummary.success) throw new Error("Summary must be 240 characters or fewer.");
  const db = getDb();
  if (!db) throw new Error("Database unavailable.");

  const current = await db.select().from(donationRequests).where(eq(donationRequests.id, requestId)).limit(1);
  if (current.length === 0) throw new Error("Request not found.");
  const row = current[0];

  const action = parsedAction.data.action;
  const nextStatus: PublicListingStatus = action === "publish" ? "published" : "unpublished";

  // Server-side dual gate: publishing requires explicit opt-in consent.
  if (action === "publish" && row.publicListingConsent !== true) {
    throw new Error("This request did not opt in to public listing.");
  }

  const summary = sanitizeListingSummary(parsedSummary.data.summary)?.slice(0, PUBLIC_LISTING_SUMMARY_MAX_LENGTH) ?? null;
  const now = new Date();
  const auditBody =
    action === "publish"
      ? `Public directory: published by ${admin.email}.`
      : `Public directory: unpublished by ${admin.email}.`;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(donationRequests)
        .set({
          publicListingStatus: nextStatus,
          publicListingSummary: summary,
          publicListingReviewedBy: admin.email,
          publicListingReviewedAt: now,
          updatedAt: now,
        })
        .where(eq(donationRequests.id, requestId));
      await tx.insert(requestNotes).values({ requestId, authorEmail: admin.email, body: auditBody });
    });
  } catch {
    reportHandledError("admin_public_listing_update");
    throw new Error("Listing update failed.");
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/temples");
}

export async function addRequestNote(requestId: string, formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const parsed = adminNoteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) throw new Error("Note cannot be empty.");
  const db = getDb();
  if (!db) throw new Error("Database unavailable.");
  await db.insert(requestNotes).values({ requestId, authorEmail: admin.email, body: parsed.data.body.trim() });
  revalidatePath(`/admin/requests/${requestId}`);
}

/**
 * Part 3B (hardened): record a fulfillment-ledger delivery.
 *
 * Temple-privacy enforcement:
 * - No free-text recipient field is honored: temple identity is resolved
 *   server-side from donationRequestId. Linked names/cities are stored ONLY
 *   when that request currently has publicListingConsent=true AND
 *   publicListingStatus="published"; otherwise an anonymized label is stored
 *   and city is omitted.
 * - Unlinked deliveries always store an anonymized label with city omitted.
 * - linkage IDs must be valid UUIDs and must exist; otherwise rejected.
 * - Repeat submissions with the same idempotencyKey return the existing row
 *   instead of creating a duplicate delivery.
 * Private fields (recordedBy, internalNotes) are admin-only and never public.
 */
export async function createFulfillmentEntry(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const { isValidUuid } = await import("./validation");
  const parsed = fulfillmentEntrySchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    state: formData.get("state") ?? "",
    poundsDelivered: formData.get("poundsDelivered"),
    sugarProductLabel: formData.get("sugarProductLabel"),
    deliveredAt: formData.get("deliveredAt"),
    publicVisible: formData.get("publicVisible") === "true",
    internalNotes: formData.get("internalNotes") ?? "",
    donationRequestId: formData.get("donationRequestId") ?? "",
    sponsorshipOrderId: formData.get("sponsorshipOrderId") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid delivery entry.";
    throw new Error(first);
  }
  const deliveredAt = toSafeDeliveredDate(parsed.data.deliveredAt);
  if (!deliveredAt) throw new Error("Enter a valid delivery date (YYYY-MM-DD). Use a real calendar date.");
  const formState = (parsed.data.state ?? "").trim().toUpperCase().slice(0, 2);
  if (formState && !/^[A-Z]{2}$/.test(formState)) throw new Error("Enter a valid 2-letter state code.");
  const donationRequestId = (parsed.data.donationRequestId ?? "").trim();
  const sponsorshipOrderId = (parsed.data.sponsorshipOrderId ?? "").trim();
  if (donationRequestId && !isValidUuid(donationRequestId)) throw new Error("Invalid linked request.");
  if (sponsorshipOrderId && !isValidUuid(sponsorshipOrderId)) throw new Error("Invalid linked sponsorship order.");
  const db = getDb();
  if (!db) throw new Error("Database unavailable.");

  // Repeat-safe: same submission key returns the existing row.
  const dup = await db
    .select({ id: fulfillmentLedger.id })
    .from(fulfillmentLedger)
    .where(eq(fulfillmentLedger.idempotencyKey, parsed.data.idempotencyKey.trim()))
    .limit(1)
    .catch(() => []);
  if (dup.length > 0) {
    revalidatePath("/sponsor");
    revalidatePath("/admin/fulfillment");
    return;
  }

  // Verify linkage exists. UUIDs are validated above; rows must exist.
  let linked: { templeName: string; city: string; state: string; publicListingConsent: boolean; publicListingStatus: string } | null = null;
  if (donationRequestId) {
    const rows = await db.select().from(donationRequests).where(eq(donationRequests.id, donationRequestId)).limit(1);
    if (rows.length === 0) throw new Error("Linked request not found.");
    const r = rows[0];
    linked = {
      templeName: r.templeName,
      city: r.city,
      state: r.state,
      publicListingConsent: r.publicListingConsent === true,
      publicListingStatus: r.publicListingStatus,
    };
  }
  if (sponsorshipOrderId) {
    const srows = await db.select({ id: sponsorshipOrders.id }).from(sponsorshipOrders).where(eq(sponsorshipOrders.id, sponsorshipOrderId)).limit(1);
    if (srows.length === 0) throw new Error("Linked sponsorship order not found.");
  }

  // Server-side identity resolution through the consent gate.
  let recipientLabel: string;
  let city: string | null;
  let state: string | null;
  if (linked) {
    const gated = linked.publicListingConsent === true && linked.publicListingStatus === "published";
    if (gated) {
      recipientLabel = linked.templeName.trim().slice(0, 200);
      city = linked.city.trim() || null;
      state = linked.state.trim().toUpperCase() || null;
    } else {
      const s = (linked.state ?? formState ?? "").trim().toUpperCase();
      recipientLabel = anonymizedRecipientLabel(/^[A-Z]{2}$/.test(s) ? s : formState || null);
      city = null;
      state = /^[A-Z]{2}$/.test(s) ? s : formState || null;
    }
  } else {
    recipientLabel = anonymizedRecipientLabel(formState || null);
    city = null;
    state = formState || null;
  }
  try {
    await db.insert(fulfillmentLedger).values({
      publicRef: generatePublicRef("SUP"),
      idempotencyKey: parsed.data.idempotencyKey.trim(),
      donationRequestId: donationRequestId || null,
      sponsorshipOrderId: sponsorshipOrderId || null,
      recipientLabel,
      city,
      state,
      poundsDelivered: Math.round(Number(parsed.data.poundsDelivered)),
      sugarProductLabel: parsed.data.sugarProductLabel.trim().slice(0, 300),
      deliveredAt,
      recordedBy: admin.email,
      internalNotes: parsed.data.internalNotes?.trim() || null,
      publicVisible: parsed.data.publicVisible === true,
    });
  } catch (err) {
    // Concurrent duplicate with the same key: treat as idempotent success.
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate|unique/i.test(msg)) {
      revalidatePath("/sponsor");
      revalidatePath("/admin/fulfillment");
      return;
    }
    reportHandledError("fulfillment_ledger_write");
    throw new Error("Could not record delivery.");
  }
  revalidatePath("/sponsor");
  revalidatePath("/admin/fulfillment");
  revalidatePath("/admin");
}

export async function setFulfillmentVisibility(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const { isValidUuid } = await import("./validation");
  const parsed = fulfillmentVisibilitySchema.safeParse({
    entryId: formData.get("entryId"),
    publicVisible: formData.get("publicVisible"),
  });
  if (!parsed.success) throw new Error("Invalid visibility update.");
  if (!isValidUuid(parsed.data.entryId)) throw new Error("Invalid visibility update.");
  const db = getDb();
  if (!db) throw new Error("Database unavailable.");
  try {
    await db
      .update(fulfillmentLedger)
      .set({ publicVisible: parsed.data.publicVisible === "true" })
      .where(eq(fulfillmentLedger.id, parsed.data.entryId));
  } catch {
    reportHandledError("fulfillment_ledger_write");
    throw new Error("Could not update visibility.");
  }
  revalidatePath("/sponsor");
  revalidatePath("/admin/fulfillment");
}

/**
 * Admin-only synthetic Sentry verification event.
 *
 * Guarded twice: requires an authenticated admin AND
 * SENTRY_TEST_ENABLED=true in the environment. The event carries a fixed
 * message with no personal information. Disable (unset the flag and redeploy)
 * after verification.
 */
export async function sendSentryVerificationEvent(): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  if (!getServerConfig().sentryTestEnabled) return;
  captureVerificationEvent();
}
