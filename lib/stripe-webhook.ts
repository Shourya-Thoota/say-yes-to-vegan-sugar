import { and, eq, inArray } from "drizzle-orm";
import { sponsorshipOrders, sponsorshipStripeEvents } from "./schema";
import { getSponsorshipTier } from "./sponsorship";
import { reportHandledError } from "./sentry";

export type StripeEventLike = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export type WebhookOutcome =
  | { action: "paid"; orderId: string }
  | { action: "expired"; orderId: string }
  | { action: "refunded"; orderId: string }
  | { action: "partially_refunded"; orderId: string }
  | { action: "ignored"; reason: string }
  | { action: "duplicate" };

export class UnknownOrderError extends Error {
  stripeEventId: string;
  eventType: string;
  constructor(eventType: string, stripeEventId: string) {
    super(`Unknown order for ${eventType} (event ${stripeEventId}).`);
    this.name = "UnknownOrderError";
    this.stripeEventId = stripeEventId;
    this.eventType = eventType;
  }
}

type DbLike = {
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
  update: (...a: any[]) => any;
  transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
};

function asRecord(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Hardened Stripe webhook processor (Part 3B).
 *
 * Safety rules (per https://docs.stripe.com/checkout/fulfillment,
 * https://docs.stripe.com/api/events/types, https://docs.stripe.com/webhooks):
 * - checkout.session.completed (and async_payment_succeeded) NEVER marks paid
 *   unless payment_status is "paid".
 * - The session's amount_total + currency are verified against the stored
 *   server-side order; mismatches never become paid.
 * - Completed/expired events NEVER overwrite refunded (or partially_refunded)
 *   orders — enforced with conditional UPDATE ... WHERE status IN (...).
 * - charge.refunded handles partial vs full: full (refunded flag or
 *   amount_refunded >= amount) -> "refunded"; otherwise "partially_refunded".
 *   Partial refunds never masquerade as full refunds.
 * - Verified Stripe event IDs are persisted with a UNIQUE constraint,
 *   atomically with the state change in one transaction. Duplicates return
 *   { action: "duplicate" }. A failed transaction persists nothing, so Stripe
 *   automatic retries (up to 3 days, exponential backoff) and manual resend
 *   from the Dashboard remain retryable.
 * - Unknown relevant orders throw UnknownOrderError WITHOUT persisting the
 *   event, so the route can answer 5xx and Stripe retries; the operator
 *   reconciles via Dashboard (metadata publicRef/tierCode) + resend.
 *   Reconciliation strategy is documented in the route response.
 */
export async function processStripeEvent(db: DbLike, event: StripeEventLike): Promise<WebhookOutcome> {
  const stripeEventId = str(event.id) ?? "";
  const type = str(event.type) ?? "";
  if (!stripeEventId || !type) return { action: "ignored", reason: "malformed-event" };
  const obj = asRecord(event.data?.object);

  const relevant =
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded" ||
    type === "checkout.session.async_payment_failed" ||
    type === "checkout.session.expired" ||
    type === "charge.refunded";
  if (!relevant) return { action: "ignored", reason: "unhandled-type" };

  return db.transaction(async (tx) => {
    // Idempotency first: replayed Stripe deliveries return fast.
    const seen = await tx
      .select({ id: sponsorshipStripeEvents.id })
      .from(sponsorshipStripeEvents)
      .where(eq(sponsorshipStripeEvents.stripeEventId, stripeEventId))
      .limit(1);
    if (seen.length > 0) return { action: "duplicate" } as WebhookOutcome;

    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const sessionId = str(obj["id"]);
      if (!sessionId) return { action: "ignored", reason: "missing-session-id" } as WebhookOutcome;
      // Never trust completion alone: require paid payment_status.
      // (Delayed methods surface via async_payment_succeeded with paid status.)
      const paymentStatus = str(obj["payment_status"]);
      if (paymentStatus !== "paid") {
        return { action: "ignored", reason: "unpaid-session" } as WebhookOutcome;
      }
      const rows = await tx
        .select()
        .from(sponsorshipOrders)
        .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
        .limit(1);
      if (rows.length === 0) throw new UnknownOrderError(type, stripeEventId);
      const row = rows[0] as Record<string, unknown>;
      // Verify amount + currency against the stored server-side order.
      const amountTotal = num(obj["amount_total"]);
      const currency = str(obj["currency"])?.toLowerCase() ?? null;
      const tier = getSponsorshipTier(String(row["tierCode"] ?? ""));
      const expectedAmount = tier ? tier.amountCents : Number(row["amountCents"]);
      const expectedCurrency = String(row["currency"] ?? "usd").toLowerCase();
      if (amountTotal !== null && amountTotal !== expectedAmount) {
        reportHandledError("stripe_webhook_receive", "/api/webhooks/stripe");
        return { action: "ignored", reason: "amount-mismatch" } as WebhookOutcome;
      }
      if (currency !== null && currency !== expectedCurrency) {
        reportHandledError("stripe_webhook_receive", "/api/webhooks/stripe");
        return { action: "ignored", reason: "currency-mismatch" } as WebhookOutcome;
      }
      // Terminal-guard: never overwrite refunded outcomes.
      const status = String(row["status"] ?? "");
      if (status === "paid") {
        await recordEvent(tx, stripeEventId, type, String(row["id"]));
        return { action: "paid", orderId: String(row["id"]) };
      }
      if (status === "refunded" || status === "partially_refunded" || status === "expired") {
        await recordEvent(tx, stripeEventId, type, String(row["id"]));
        return { action: "ignored", reason: `completed-after-${status}` } as WebhookOutcome;
      }
      const paymentIntent = str(obj["payment_intent"]);
      const details = asRecord(obj["customer_details"]);
      const detailEmail = str(details["email"]);
      const legacyEmail = str(obj["customer_email"]);
      const email = (detailEmail ?? legacyEmail ?? "").trim().toLowerCase();
      const safeEmail = email.includes("@") ? email : null;
      // Conditional update: only pending -> paid wins the race.
      const updated = await tx
        .update(sponsorshipOrders)
        .set({
          status: "paid",
          paidAt: (row["paidAt"] as Date | null) ?? new Date(),
          stripePaymentIntentId: paymentIntent ?? (row["stripePaymentIntentId"] as string | null),
          sponsorEmail: safeEmail ?? (row["sponsorEmail"] as string | null),
          updatedAt: new Date(),
        })
        .where(and(eq(sponsorshipOrders.id, String(row["id"])), eq(sponsorshipOrders.status, "pending")))
        .returning({ id: sponsorshipOrders.id });
      await recordEvent(tx, stripeEventId, type, String(row["id"]));
      if (updated.length === 0) return { action: "ignored", reason: "race-lost" } as WebhookOutcome;
      return { action: "paid", orderId: String(row["id"]) };
    }

    if (type === "checkout.session.async_payment_failed" || type === "checkout.session.expired") {
      const sessionId = str(obj["id"]);
      if (!sessionId) return { action: "ignored", reason: "missing-session-id" } as WebhookOutcome;
      const rows = await tx
        .select()
        .from(sponsorshipOrders)
        .where(eq(sponsorshipOrders.stripeCheckoutSessionId, sessionId))
        .limit(1);
      if (rows.length === 0) throw new UnknownOrderError(type, stripeEventId);
      const row = rows[0] as Record<string, unknown>;
      const status = String(row["status"] ?? "");
      // Only pending rows expire; paid/refunded outcomes are terminal.
      if (status !== "pending") {
        await recordEvent(tx, stripeEventId, type, String(row["id"]));
        return { action: "ignored", reason: `terminal-${status}` } as WebhookOutcome;
      }
      await tx
        .update(sponsorshipOrders)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(sponsorshipOrders.id, String(row["id"])), eq(sponsorshipOrders.status, "pending")));
      await recordEvent(tx, stripeEventId, type, String(row["id"]));
      return { action: "expired", orderId: String(row["id"]) };
    }

    // charge.refunded (fires for full AND partial refunds).
    const charge = obj;
    const pi = str(charge["payment_intent"]);
    if (!pi) return { action: "ignored", reason: "missing-payment-intent" } as WebhookOutcome;
    const rows = await tx
      .select()
      .from(sponsorshipOrders)
      .where(eq(sponsorshipOrders.stripePaymentIntentId, pi))
      .limit(1);
    if (rows.length === 0) throw new UnknownOrderError(type, stripeEventId);
    const row = rows[0] as Record<string, unknown>;
    const status = String(row["status"] ?? "");
    if (status === "refunded") {
      await recordEvent(tx, stripeEventId, type, String(row["id"]));
      return { action: "refunded", orderId: String(row["id"]) };
    }
    // Partial vs full: Stripe docs — charge.refunded occurs for partial
    // refunds too; amount_refunded < amount means partial (and `refunded`
    // may be false). Never label a partial refund as a full refund.
    const amount = num(charge["amount"]);
    const amountRefunded = num(charge["amount_refunded"]);
    const refundedFlag = charge["refunded"] === true;
    const isFull =
      refundedFlag ||
      (amount !== null && amountRefunded !== null && amountRefunded >= amount) ||
      (amount === null && amountRefunded === null);
    const priorRefunded = Number(row["refundedAmountCents"] ?? 0);
    const nextRefunded =
      amountRefunded !== null
        ? Math.max(priorRefunded, amountRefunded)
        : Number(row["amountCents"] ?? priorRefunded);
    if (!isFull) {
      await tx
        .update(sponsorshipOrders)
        .set({ status: "partially_refunded", refundedAmountCents: nextRefunded, updatedAt: new Date() })
        .where(
          and(
            eq(sponsorshipOrders.id, String(row["id"])),
            inArray(sponsorshipOrders.status, ["paid", "partially_refunded", "pending"])
          )
        );
      await recordEvent(tx, stripeEventId, type, String(row["id"]));
      return { action: "partially_refunded", orderId: String(row["id"]) };
    }
    await tx
      .update(sponsorshipOrders)
      .set({ status: "refunded", refundedAmountCents: nextRefunded, updatedAt: new Date() })
      .where(
        and(
          eq(sponsorshipOrders.id, String(row["id"])),
          inArray(sponsorshipOrders.status, ["paid", "partially_refunded", "pending"])
        )
      );
    await recordEvent(tx, stripeEventId, type, String(row["id"]));
    return { action: "refunded", orderId: String(row["id"]) };
  });
}

async function recordEvent(tx: DbLike, stripeEventId: string, eventType: string, orderId: string | null) {
  await tx.insert(sponsorshipStripeEvents).values({
    stripeEventId,
    eventType,
    orderId,
  });
}
