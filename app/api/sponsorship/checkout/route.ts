import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sponsorshipOrders } from "@/lib/schema";
import { getSponsorshipTier, sanitizeSponsorDisplayName } from "@/lib/sponsorship";
import { getSiteBaseUrl, isStripeSponsorshipEnabled } from "@/lib/config";
import { sponsorshipCheckoutSchema, flattenZodErrors } from "@/lib/validation";
import { generatePublicRef } from "@/lib/reference";
import { bucketKey, checkRateLimit } from "@/lib/rate-limit";
import { reportHandledError } from "@/lib/sentry";

/**
 * Part 3B: create a Stripe Hosted Checkout Session for a fixed tier.
 * Zero-key safe: 503 when Stripe is not enabled. Prices come from the
 * server-side tier table — the client can only send a tier code.
 */
export async function POST(req: Request) {
  if (!isStripeSponsorshipEnabled()) {
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
  const rl = await checkRateLimit(bucketKey("sponsorship-checkout", headers), 20, 3600);
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

  const tier = getSponsorshipTier(v.tierCode);
  if (!tier) {
    return NextResponse.json({ ok: false, errors: { tierCode: "Choose a sponsorship tier." } }, { status: 422 });
  }

  const secretKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, message: "Online sponsorship is not available yet. Please check back soon." },
      { status: 503 }
    );
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, errors: { _form: "Sponsorship is temporarily unavailable. Please try again later." } },
      { status: 503 }
    );
  }

  const sponsorDisplayName = sanitizeSponsorDisplayName(v.sponsorDisplayName);
  const publicRecognitionConsent = v.publicRecognitionConsent === true;
  const publicRef = generatePublicRef("SUP");
  const baseUrl = getSiteBaseUrl(process.env);

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Temple Initiative sponsorship — ${tier.label} of vegan sugar`,
              description: "Supports vegan sugar purchases and deliveries for participating temples. Not a tax-deductible donation.",
            },
            unit_amount: tier.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/sponsor/success?ref=${encodeURIComponent(publicRef)}`,
      cancel_url: `${baseUrl}/sponsor?cancelled=1`,
      metadata: { publicRef, tierCode: tier.code },
      payment_intent_data: { metadata: { publicRef, tierCode: tier.code } },
    });

    await db.insert(sponsorshipOrders).values({
      publicRef,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: null,
      tierCode: tier.code,
      amountCents: tier.amountCents,
      currency: "usd",
      estimatedPounds: tier.estimatedPounds,
      sponsorDisplayName,
      sponsorEmail: null,
      publicRecognitionConsent,
      status: "pending",
      allocatedRequestId: null,
    });

    return NextResponse.json({ ok: true, url: session.url, publicRef });
  } catch (err) {
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
