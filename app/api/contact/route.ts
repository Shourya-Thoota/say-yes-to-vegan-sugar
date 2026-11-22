import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contactInquiries } from "@/lib/schema";
import { contactSchema, flattenZodErrors } from "@/lib/validation";
import { generatePublicRef } from "@/lib/reference";
import { bucketKey, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const raw = await req.text().catch(() => null);
  if (raw === null) return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  if (raw.length > 32_000) return NextResponse.json({ ok: false, message: "Submission is too large." }, { status: 413 });

  const rl = await checkRateLimit(bucketKey("contact", req.headers as unknown as Headers), 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: "Too many submissions. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: flattenZodErrors(parsed.error) }, { status: 422 });
  }
  const v = parsed.data;
  if (v.company?.trim()) return NextResponse.json({ ok: true, ref: "CON-0000-0000" });

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, errors: { _form: "Submissions are temporarily unavailable. Please try again later." } }, { status: 503 });
  }
  try {
    const existing = await db.select({ publicRef: contactInquiries.publicRef }).from(contactInquiries).where(eq(contactInquiries.idempotencyKey, v.idempotencyKey)).limit(1);
    if (existing.length > 0) return NextResponse.json({ ok: true, ref: existing[0].publicRef, deduped: true });
    const publicRef = generatePublicRef("CON");
    await db.insert(contactInquiries).values({
      publicRef,
      idempotencyKey: v.idempotencyKey,
      name: v.name.trim(),
      email: v.email.trim().toLowerCase(),
      subject: v.subject.trim(),
      message: v.message.trim(),
      privacyConsent: true,
      privacyPolicyVersion: "v1",
      status: "submitted",
    });
    return NextResponse.json({ ok: true, ref: publicRef }, { status: 201 });
  } catch {
    console.error("[api/contact] insert failed");
    return NextResponse.json({ ok: false, errors: { _form: "We could not save your message. Please try again." } }, { status: 500 });
  }
}
