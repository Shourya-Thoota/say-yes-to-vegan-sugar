"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  donationRequests,
  requestNotes,
  statusHistory,
  PUBLIC_LISTING_SUMMARY_MAX_LENGTH,
  type PublicListingStatus,
} from "./schema";
import { requireAdmin } from "./auth";
import { adminListingActionSchema, adminListingSummarySchema, adminNoteSchema, adminStatusSchema } from "./validation";
import { sanitizeListingSummary } from "./public-directory";
import { getServerConfig } from "./config";
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
