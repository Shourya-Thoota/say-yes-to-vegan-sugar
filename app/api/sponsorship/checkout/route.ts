import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSiteBaseUrl, isStripeSponsorshipEnabled } from "@/lib/config";
import { sponsorshipCheckoutSchema, flattenZodErrors } from "@/lib/validation";
import { SPONSORSHIP_TERMS_VERSION } from "@/lib/sponsorship";
import { AttemptConflictError, processSponsorshipCheckout } from "@/lib/sponsorship-checkout";
import { bucketKey, checkRateLimit } from "@/lib/rate-limit";
import { reportHandledError } from "@/lib/sentry";

/**
 * Part 3B (hardened): retry-safe Stripe Hosted Checkout.
 * Zero-key safe: 503 when Stripe is not fully configured. New checkouts
 * require ENABLE_STRIPE_SPONSORSHIP=true AND a nonempty STRIPE_SECRET_KEY
 * AND a nonempty STRIPE_WEBHOOK_SECRET (so paid webhooks can be verified).
 * Prices come from the server-side tier table — the client sends only a tier
 * code plus a validated attempt key and accepted terms version.
 */
export async function POST(req: Request) {
  if (!isStripeSponsorshipEnabled()) {
    return NextResponse.json(
      { ok: false, message: "Online sponsorship is not available yet. Please check back soon." },
      { status: 503 }
    );
  }
  // Full gating: without a webhook secret, paid events could never be
  // verified, so refuse to create new checkouts.
  if (!(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim()) {
    return NextResponse.json(
      { ok: false, message: "Online sponsorship is not available yet. Please check back soon." },
      { status: 503 }
    );
  }

  const raw = await req.text().catch(() => null);
  if (raw === null) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  if (raw.length > 32_000) {
    return NextResponse.json({ ok: false, message: "Request is too large." }, { status: 413 });
  }

  const headers = req.headers as unknown as Headers;
  const db = getDb();
  const rl = await checkRateLimit(db, bucketKey("sponsorship-checkout", headers), 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = sponsorshipCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: flattenZodErrors(parsed.error) }, { status: 422 });
  }
  const v = parsed.data;
  if ((v.termsVersion ?? "v1") !== SPONSORSHIP_TERMS_VERSION) {
    return NextResponse.json(
      { ok: false, errors: { termsVersion: "These sponsorship terms have changed. Please review and accept the current terms." } },
      { status: 422 }
    );
  }

  const secretKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, message: "Online sponsorship is not available yet. Please check back soon." },
      { status: 503 }
    );
  }

  if (!db) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Sponsorship is temporarily unavailable. Please try again later." } },
      { status: 503 }
    );
  }

  const baseUrl = getSiteBaseUrl(process.env);

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);
    const result = await processSponsorshipCheckout(
      db as never,
      stripe.checkout.sessions as never,
      { tierCode: v.tierCode, attemptKey: v.attemptKey.trim(), termsVersion: v.termsVersion },
      { baseUrl }
    );
    return NextResponse.json({ ok: true, url: result.url, publicRef: result.publicRef });
  } catch (err) {
    if (err instanceof AttemptConflictError) {
      return NextResponse.json({ ok: false, errors: { _form: err.message } }, { status: 409 });
    }
    // Never forward Stripe/DB internals to the client.
    console.error("[api/sponsorship/checkout] failed");
    reportHandledError("sponsorship_checkout_create", "/api/sponsorship/checkout");
    void err;
    return NextResponse.json(
      { ok: false, errors: { _form: "We could not start checkout. Please try again." } },
      { status: 500 }
    );
  }
}
