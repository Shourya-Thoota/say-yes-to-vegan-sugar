import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { donationRequests, statusHistory } from "@/lib/schema";
import { donationRequestSchema, flattenZodErrors } from "@/lib/validation";
import { generatePublicRef } from "@/lib/reference";
import { bucketKey, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Request-size limit
  const raw = await req.text().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  if (raw.length > 64_000) {
    return NextResponse.json({ ok: false, message: "Submission is too large." }, { status: 413 });
  }

  // Rate limit: 10 submissions/hour per IP
  const headers = req.headers as unknown as Headers;
  const rl = await checkRateLimit(bucketKey("requests", headers), 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = donationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: flattenZodErrors(parsed.error) },
      { status: 422 }
    );
  }
  const v = parsed.data;

  // Honeypot: pretend success without persisting
  if (v.company && v.company.trim().length > 0) {
    return NextResponse.json({ ok: true, ref: "SVS-0000-0000", message: "Received." });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Submissions are temporarily unavailable. Please try again later." } },
      { status: 503 }
    );
  }

  try {
    // Idempotency: return existing ref if this key was already submitted
    const existing = await db
      .select({ publicRef: donationRequests.publicRef })
      .from(donationRequests)
      .where(eq(donationRequests.idempotencyKey, v.idempotencyKey))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, ref: existing[0].publicRef, deduped: true });
    }

    const publicRef = generatePublicRef("SVS");
    const inserted = await db
      .insert(donationRequests)
      .values({
        publicRef,
        idempotencyKey: v.idempotencyKey,
        templeName: v.templeName.trim(),
        templeWebsite: v.templeWebsite?.trim() || null,
        streetAddress: v.streetAddress.trim(),
        addressLine2: v.addressLine2?.trim() || null,
        city: v.city.trim(),
        state: v.state,
        zipCode: v.zipCode.trim(),
        country: "US",
        contactName: v.contactName.trim(),
        contactRole: v.contactRole.trim(),
        contactEmail: v.contactEmail.trim().toLowerCase(),
        contactPhone: v.contactPhone?.trim() || null,
        preferredContact: v.preferredContact,
        authorized: true,
        authorizedAt: new Date(),
        quantityPounds: Math.round(Number(v.quantityPounds)),
        dateNeeded: v.dateNeeded || null,
        intendedUse: v.intendedUse,
        otherUseExplanation: v.otherUseExplanation?.trim() || null,
        currentProduct: v.currentProduct?.trim() || null,
        productPreferences: v.productPreferences?.trim() || null,
        deliveryInstructions: v.deliveryInstructions?.trim() || null,
        additionalNotes: v.additionalNotes?.trim() || null,
        understandsNoGuarantee: true,
        privacyConsent: true,
        privacyPolicyVersion: "v1",
        status: "submitted",
      })
      .returning({ id: donationRequests.id, publicRef: donationRequests.publicRef });

    await db.insert(statusHistory).values({
      requestId: inserted[0].id,
      fromStatus: null,
      toStatus: "submitted",
      changedBy: "system",
    });

    return NextResponse.json({ ok: true, ref: inserted[0].publicRef }, { status: 201 });
  } catch (err) {
    // Unique violation on retry race -> fetch by idempotency key
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      try {
        const existing = await db
          .select({ publicRef: donationRequests.publicRef })
          .from(donationRequests)
          .where(eq(donationRequests.idempotencyKey, v.idempotencyKey))
          .limit(1);
        if (existing.length > 0) return NextResponse.json({ ok: true, ref: existing[0].publicRef, deduped: true });
      } catch { /* fall through */ }
    }
    console.error("[api/requests] insert failed");
    return NextResponse.json(
      { ok: false, errors: { _form: "We could not save your request. Your values were preserved — please try again." } },
      { status: 500 }
    );
  }
}
