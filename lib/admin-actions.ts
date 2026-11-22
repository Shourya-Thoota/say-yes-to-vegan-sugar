"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { donationRequests, requestNotes, statusHistory } from "./schema";
import { requireAdmin } from "./auth";
import { adminNoteSchema, adminStatusSchema } from "./validation";

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
  revalidatePath("/admin");
  revalidatePath(`/admin/requests/${requestId}`);
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
