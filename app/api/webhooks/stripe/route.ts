import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sponsorshipOrders } from "@/lib/schema";
import { reportHandledError } from "@/lib/sentry";

/**
 * Part 3B: idempotent Stripe webhook receiver.
 * - 503 when STRIPE_WEBHOOK_SECRET is missing (zero-key safe).
 * - 400 when the signature is missing or verification fails (fail-closed).
 * - 200 { received: true } for verified events, including replays.
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

  let event: { type: string; data: { object: Record<string, unknown> } };
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
    const type = event.type;
    const obj = event.data?.object ?? {};

    if (type === "checkout.session.completed") {
      const sessionId = obj["id"] as string | undefined;
      if (!sessionId) return NextResponse.json({ received: true });
      const paymentIntent = (obj["payment_intent"] as string | null | undefined) ?? null;
      const customerEmail =
        ((obj["customer_details"] as { email?: unknown } | null | undefined)?.email as string | undefined) ??
        (obj["customer_email"] as string | undefined) ??
        null;
      const rows = await db
        .select()
        .from(sponsorshipOrders)
        .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
        .limit(1);
      if (rows.length === 0) return NextResponse.json({ received: true });
      const row = rows[0];
      // Idempotent: replaying a completed event must not change a paid row.
      if (row.status === "paid") return NextResponse.json({ received: true });
      await db
        .update(sponsorshipOrders)
        .set({
          status: "paid",
          paidAt: row.paidAt ?? new Date(),
          stripePaymentIntentId: typeof paymentIntent === "string" ? paymentIntent : row.stripePaymentIntentId,
          sponsorEmail:
            typeof customerEmail === "string" && customerEmail.includes("@")
              ? customerEmail.trim().toLowerCase()
              : row.sponsorEmail,
          updatedAt: new Date(),
        })
        .where(eq(sponsorshipOrders.id, row.id));
      return NextResponse.json({ received: true });
    }

    if (type === "checkout.session.expired") {
      const sessionId = obj["id"] as string | undefined;
      if (!sessionId) return NextResponse.json({ received: true });
      const rows = await db
        .select()
        .from(sponsorshipOrders)
        .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
        .limit(1);
      if (rows.length === 0) return NextResponse.json({ received: true });
      const row = rows[0];
      // Only pending rows expire; never overwrite paid/refunded.
      if (row.status !== "pending") return NextResponse.json({ received: true });
      await db
        .update(sponsorshipOrders)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(sponsorshipOrders.id, row.id));
      return NextResponse.json({ received: true });
    }

    if (type === "charge.refunded") {
      const charge = obj as Record<string, unknown>;
      const pi = charge["payment_intent"] as string | undefined;
      if (!pi) return NextResponse.json({ received: true });
      const rows = await db
        .select()
        .from(sponsorshipOrders)
        .where(eq(sponsorshipOrders.stripePaymentIntentId, pi))
        .limit(1);
      if (rows.length === 0) return NextResponse.json({ received: true });
      const row = rows[0];
      if (row.status === "refunded") return NextResponse.json({ received: true });
      await db
        .update(sponsorshipOrders)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(sponsorshipOrders.id, row.id));
      return NextResponse.json({ received: true });
    }

    // Unknown verified event types are acknowledged without action.
    return NextResponse.json({ received: true });
  } catch {
    reportHandledError("stripe_webhook_receive", "/api/webhooks/stripe");
    return NextResponse.json({ ok: false, message: "Webhook processing failed." }, { status: 500 });
  }
}
