import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UnknownOrderError, processStripeEvent } from "@/lib/stripe-webhook";
import { reportHandledError } from "@/lib/sentry";

/**
 * Part 3B (hardened) idempotent Stripe webhook receiver.
 * - 503 when STRIPE_WEBHOOK_SECRET is missing (zero-key safe).
 * - Webhook processing stays available when new checkouts are disabled, as
 *   long as the webhook secret (+ secret key) is present, so in-flight paid
 *   sessions can still settle.
 * - 400 when the signature is missing or verification fails (fail-closed).
 * - 200 { received: true } for verified events, including replays and
 *   deliberately ignored events (unpaid sessions, amount mismatches,
 *   terminal-state guards, unhandled types).
 * - 500 { retryable: true } when a RELEVANT payment event references an
 *   unknown order or when processing fails: the event is NOT acknowledged as
 *   processed (no event row is persisted), so Stripe automatic retries (up to
 *   ~3 days, exponential backoff) and manual Dashboard resend remain possible.
 *   Reconciliation: find the session/payment in the Stripe Dashboard via the
 *   metadata publicRef/tierCode/attemptKey, verify the order row, then resend
 *   the event (Dashboard -> Developers -> Webhooks -> Resend, up to 15 days;
 *   or `stripe events resend <evt_id>` up to 30 days).
 *
 * Event behavior per Stripe docs (https://docs.stripe.com/checkout/fulfillment,
 * https://docs.stripe.com/api/events/types, https://docs.stripe.com/webhooks):
 * - checkout.session.completed fires on completion, but funds may not be
 *   captured for delayed methods; payment_status + amount_total + currency
 *   must be verified (see lib/stripe-webhook.ts).
 * - Delayed methods settle via checkout.session.async_payment_succeeded /
 *   async_payment_failed. This release creates card-only sessions, but the
 *   handler supports those async events explicitly.
 * - charge.refunded fires for full AND partial refunds; partial refunds must
 *   not be labeled as full refunds.
 */
export async function POST(req: Request) {
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, message: "Webhook receiver is not configured." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "Missing signature." }, { status: 400 });
  }

  const rawBody = await req.text().catch(() => null);
  if (rawBody === null) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const secretKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, message: "Webhook receiver is not configured." },
      { status: 503 }
    );
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);
    const verified = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    event = verified as unknown as typeof event;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid signature." }, { status: 400 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Database unavailable." }, { status: 503 });
  }

  try {
    const outcome = await processStripeEvent(db as never, {
      id: String(event.id ?? ""),
      type: String(event.type ?? ""),
      data: { object: (event.data?.object ?? {}) as Record<string, unknown> },
    });
    if (outcome.action === "duplicate" || outcome.action === "ignored") {
      return NextResponse.json({ received: true });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    if (err instanceof UnknownOrderError) {
      // Do NOT acknowledge: no event row was persisted, so this stays
      // retryable. Operator reconciles via Dashboard + resend.
      reportHandledError("stripe_webhook_receive", "/api/webhooks/stripe");
      return NextResponse.json(
        {
          ok: false,
          retryable: true,
          message:
            "Payment event received for an unknown order; it was not processed. It will be retried automatically — no action is needed unless retries keep failing, in which case reconcile the session in the Stripe Dashboard (metadata publicRef/tierCode) and resend the event.",
        },
        { status: 500 }
      );
    }
    // Unique-violation on the event id under concurrency means another
    // worker already processed it: acknowledge as received.
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json({ received: true });
    }
    reportHandledError("stripe_webhook_receive", "/api/webhooks/stripe");
    return NextResponse.json(
      { ok: false, retryable: true, message: "Webhook processing failed; the event was not processed and will be retried." },
      { status: 500 }
    );
  }
}
