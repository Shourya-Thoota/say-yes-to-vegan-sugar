import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { supportOffers } from "@/lib/schema";
import { supportOfferSchema, flattenZodErrors } from "@/lib/validation";
import { generatePublicRef } from "@/lib/reference";
import { bucketKey, checkRateLimit } from "@/lib/rate-limit";
import { reportHandledError } from "@/lib/sentry";

export async function POST(req: Request) {
  const raw = await req.text().catch(() => null);
  if (raw === null) return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  if (raw.length > 32_000) return NextResponse.json({ ok: false, message: "Submission is too large." }, { status: 413 });

  const rl = await checkRateLimit(bucketKey("support", req.headers as unknown as Headers), 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: "Too many submissions. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const parsed = supportOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: flattenZodErrors(parsed.error) }, { status: 422 });
  }
  const v = parsed.data;
  if (v.company?.trim()) return NextResponse.json({ ok: true, ref: "SUP-0000-0000" });

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, errors: { _form: "Submissions are temporarily unavailable. Please try again later." } }, { status: 503 });
  }
  try {
    const existing = await db.select({ publicRef: supportOffers.publicRef }).from(supportOffers).where(eq(supportOffers.idempotencyKey, v.idempotencyKey)).limit(1);
    if (existing.length > 0) return NextResponse.json({ ok: true, ref: existing[0].publicRef, deduped: true });
    const publicRef = generatePublicRef("SUP");
    await db.insert(supportOffers).values({
      publicRef,
      idempotencyKey: v.idempotencyKey,
      name: v.name.trim(),
      email: v.email.trim().toLowerCase(),
      organization: v.organization?.trim() || null,
      city: v.city?.trim() || null,
      state: v.state?.trim() || null,
      supportType: v.supportType,
      message: v.message.trim(),
      privacyConsent: true,
      privacyPolicyVersion: "v1",
      status: "submitted",
    });
    return NextResponse.json({ ok: true, ref: publicRef }, { status: 201 });
  } catch (err) {
    // Unique violation on retry race -> fetch by idempotency key instead of failing.
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      try {
        const existing = await db.select({ publicRef: supportOffers.publicRef }).from(supportOffers).where(eq(supportOffers.idempotencyKey, v.idempotencyKey)).limit(1);
        if (existing.length > 0) return NextResponse.json({ ok: true, ref: existing[0].publicRef, deduped: true });
      } catch { /* fall through */ }
    }
    console.error("[api/support] insert failed");
    reportHandledError("support_offer_create", "persistence", err, "/api/support");
    return NextResponse.json({ ok: false, errors: { _form: "We could not save your message. Please try again." } }, { status: 500 });
  }
}
