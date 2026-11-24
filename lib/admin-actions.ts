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
 * Part 3B: record a fulfillment-ledger delivery. Private fields
 * (recordedBy, internalNotes) are admin-only and never rendered publicly.
 * When donationRequestId links to an opted-in + published temple, callers may
 * pass its public name; otherwise use an anonymized label.
 */
export async function createFulfillmentEntry(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const parsed = fulfillmentEntrySchema.safeParse({
    recipientLabel: formData.get("recipientLabel"),
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    poundsDelivered: formData.get("poundsDelivered"),
    sugarProductLabel: formData.get("sugarProductLabel"),
    deliveredAt: formData.get("deliveredAt"),
    publicVisible: formData.get("publicVisible") === "true" || formData.get("publicVisible") === "on",
    internalNotes: formData.get("internalNotes") ?? "",
    donationRequestId: formData.get("donationRequestId") ?? "",
    sponsorshipOrderId: formData.get("sponsorshipOrderId") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid delivery entry.";
    throw new Error(first);
  }
  const deliveredAt = toSafeDeliveredDate(parsed.data.deliveredAt);
  if (!deliveredAt) throw new Error("Enter a valid delivery date (YYYY-MM-DD).");
  const state = (parsed.data.state ?? "").trim().toUpperCase().slice(0, 2);
  if (state && !/^[A-Z]{2}$/.test(state)) throw new Error("Enter a valid 2-letter state code.");
  const db = getDb();
  if (!db) throw new Error("Database unavailable.");
  const recipientLabel = parsed.data.recipientLabel.trim().slice(0, 200) || anonymizedRecipientLabel(state);
  try {
    await db.insert(fulfillmentLedger).values({
      publicRef: generatePublicRef("SUP"),
      donationRequestId: parsed.data.donationRequestId?.trim() || null,
      sponsorshipOrderId: parsed.data.sponsorshipOrderId?.trim() || null,
      recipientLabel,
      city: parsed.data.city?.trim() || null,
      state: state || null,
      poundsDelivered: Math.round(Number(parsed.data.poundsDelivered)),
      sugarProductLabel: parsed.data.sugarProductLabel.trim().slice(0, 300),
      deliveredAt,
      recordedBy: admin.email,
      internalNotes: parsed.data.internalNotes?.trim() || null,
      publicVisible: parsed.data.publicVisible === true,
    });
  } catch {
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
  const parsed = fulfillmentVisibilitySchema.safeParse({
    entryId: formData.get("entryId"),
    publicVisible: formData.get("publicVisible"),
  });
  if (!parsed.success) throw new Error("Invalid visibility update.");
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
