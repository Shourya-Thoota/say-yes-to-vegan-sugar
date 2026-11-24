import { eq } from "drizzle-orm";
import { sponsorshipCheckoutAttempts, sponsorshipOrders } from "./schema";
import { getSponsorshipTier, SPONSORSHIP_TERMS_VERSION } from "./sponsorship";
import { generatePublicRef } from "./reference";

export type CheckoutInput = {
  tierCode: string;
  attemptKey: string;
  termsVersion?: string;
};

export type CheckoutResult = {
  url: string;
  publicRef: string;
  sessionId: string;
  reused: boolean;
};

export type StripeSessionCreator = {
  create: (
    params: Record<string, unknown>,
    opts?: { idempotencyKey?: string }
  ) => Promise<{ id: string; url: string | null }>;
};

type DbLike = {
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
  update: (...a: any[]) => any;
  transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
};

export class AttemptConflictError extends Error {
  constructor() {
    super("This checkout attempt was already used with different details. Please start a new checkout.");
    this.name = "AttemptConflictError";
  }
}

/**
 * Retry-safe checkout (Part 3B hardening).
 *
 * - The validated client attempt key has a UNIQUE DB constraint.
 * - The key is bound to its original tier/terms; conflicting reuse is rejected
 *   with 409 so an attacker cannot swap tiers under a reused key.
 * - The local attempt is persisted BEFORE creating the Stripe session, and
 *   the Stripe call reuses `sponsorship-checkout-<attemptKey>` as its
 *   idempotency key, so Stripe returns the same session across retries.
 * - If the process crashes between session creation and order persistence,
 *   a retry with the same attempt key reuses the same Stripe session and
 *   completes the local persistence — the order is never lost.
 * - Prices stay server-controlled (tier table only).
 */
export async function processSponsorshipCheckout(
  db: DbLike,
  stripeSessions: StripeSessionCreator,
  input: CheckoutInput,
  opts: { baseUrl: string }
): Promise<CheckoutResult> {
  const tier = getSponsorshipTier(input.tierCode);
  if (!tier) throw new Error("Choose a sponsorship tier.");
  const termsVersion =
    (input.termsVersion ?? SPONSORSHIP_TERMS_VERSION).trim() || SPONSORSHIP_TERMS_VERSION;

  // Fast path: attempt already completed -> return same usable session.
  const existing = await db
    .select()
    .from(sponsorshipCheckoutAttempts)
    .where(eq(sponsorshipCheckoutAttempts.attemptKey, input.attemptKey))
    .limit(1);
  if (existing.length > 0) {
    const row = existing[0] as Record<string, unknown>;
    if (String(row["tierCode"]) !== tier.code || String(row["termsVersion"] ?? "v1") !== termsVersion) {
      throw new AttemptConflictError();
    }
    const sessionId = row["stripeSessionId"] as string | null;
    const sessionUrl = row["stripeSessionUrl"] as string | null;
    const publicRef = row["publicRef"] as string | null;
    if (sessionId && sessionUrl && publicRef) {
      // Ensure the order row exists (crash between session + order insert).
      await ensureOrderForAttempt(db, {
        attemptKey: input.attemptKey,
        tierCode: tier.code,
        amountCents: tier.amountCents,
        estimatedPounds: tier.estimatedPounds,
        termsVersion,
        publicRef,
        sessionId,
      });
      return { url: sessionUrl, publicRef, sessionId, reused: true };
    }
    // Attempt exists but session creation never finished -> fall through and
    // create the Stripe session (idempotent on Stripe's side).
    const ref = (row["publicRef"] as string | null) ?? generatePublicRef("SUP");
    const created = await createStripeSession(stripeSessions, input.attemptKey, tier, opts.baseUrl, ref);
    await ensureOrderForAttempt(db, {
      attemptKey: input.attemptKey,
      tierCode: tier.code,
      amountCents: tier.amountCents,
      estimatedPounds: tier.estimatedPounds,
      termsVersion,
      publicRef: ref,
      sessionId: created.id,
    });
    await db
      .update(sponsorshipCheckoutAttempts)
      .set({ stripeSessionId: created.id, stripeSessionUrl: created.url, publicRef: ref, updatedAt: new Date() })
      .where(eq(sponsorshipCheckoutAttempts.attemptKey, input.attemptKey));
    if (!created.url) throw new Error("We could not start checkout. Please try again.");
    return { url: created.url, publicRef: ref, sessionId: created.id, reused: true };
  }

  // Persist the local attempt BEFORE touching Stripe.
  const publicRef = generatePublicRef("SUP");
  try {
    await db.insert(sponsorshipCheckoutAttempts).values({
      attemptKey: input.attemptKey,
      tierCode: tier.code,
      termsVersion,
      publicRef,
    });
  } catch {
    // Concurrent insert won the race: re-read and reuse.
    const raced = await db
      .select()
      .from(sponsorshipCheckoutAttempts)
      .where(eq(sponsorshipCheckoutAttempts.attemptKey, input.attemptKey))
      .limit(1);
    if (raced.length > 0) {
      const row = raced[0] as Record<string, unknown>;
      if (String(row["tierCode"]) !== tier.code) throw new AttemptConflictError();
      const sessionId = row["stripeSessionId"] as string | null;
      const sessionUrl = row["stripeSessionUrl"] as string | null;
      const ref = (row["publicRef"] as string | null) ?? publicRef;
      if (sessionId && sessionUrl) {
        await ensureOrderForAttempt(db, {
          attemptKey: input.attemptKey,
          tierCode: tier.code,
          amountCents: tier.amountCents,
          estimatedPounds: tier.estimatedPounds,
          termsVersion,
          publicRef: ref,
          sessionId,
        });
        return { url: sessionUrl, publicRef: ref, sessionId, reused: true };
      }
      // Attempt exists without a session (concurrent writers): create the
      // Stripe session idempotently and finish persistence below.
      const created = await createStripeSession(stripeSessions, input.attemptKey, tier, opts.baseUrl, ref);
      await ensureOrderForAttempt(db, {
        attemptKey: input.attemptKey,
        tierCode: tier.code,
        amountCents: tier.amountCents,
        estimatedPounds: tier.estimatedPounds,
        termsVersion,
        publicRef: ref,
        sessionId: created.id,
      });
      await db
        .update(sponsorshipCheckoutAttempts)
        .set({ stripeSessionId: created.id, stripeSessionUrl: created.url, updatedAt: new Date() })
        .where(eq(sponsorshipCheckoutAttempts.attemptKey, input.attemptKey));
      if (!created.url) throw new Error("We could not start checkout. Please try again.");
      return { url: created.url, publicRef: ref, sessionId: created.id, reused: true };
    }
    throw new Error("We could not start checkout. Please try again.");
  }

  const created = await createStripeSession(stripeSessions, input.attemptKey, tier, opts.baseUrl, publicRef);
  await ensureOrderForAttempt(db, {
    attemptKey: input.attemptKey,
    tierCode: tier.code,
    amountCents: tier.amountCents,
    estimatedPounds: tier.estimatedPounds,
    termsVersion,
    publicRef,
    sessionId: created.id,
  });
  await db
    .update(sponsorshipCheckoutAttempts)
    .set({ stripeSessionId: created.id, stripeSessionUrl: created.url, updatedAt: new Date() })
    .where(eq(sponsorshipCheckoutAttempts.attemptKey, input.attemptKey));
  if (!created.url) throw new Error("We could not start checkout. Please try again.");
  return { url: created.url, publicRef, sessionId: created.id, reused: false };
}

async function createStripeSession(
  stripeSessions: StripeSessionCreator,
  attemptKey: string,
  tier: { code: string; label: string; amountCents: number },
  baseUrl: string,
  publicRef: string
): Promise<{ id: string; url: string | null }> {
  return stripeSessions.create(
    {
      mode: "payment",
      // Card-only for this release: keeps settlement synchronous so
      // checkout.session.completed with payment_status=paid is authoritative.
      // (Delayed methods would require async_payment_succeeded/failed flows.)
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Temple Initiative sponsorship — ${tier.label} of vegan sugar (estimate)`,
              description:
                "Provisional launch amount. Supports vegan sugar purchases and deliveries for participating temples. Not a tax-deductible donation; non-refundable except for billing errors.",
            },
            unit_amount: tier.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/sponsor/success?ref=${encodeURIComponent(publicRef)}`,
      cancel_url: `${baseUrl}/sponsor?cancelled=1`,
      metadata: { tierCode: tier.code, attemptKey },
      payment_intent_data: { metadata: { tierCode: tier.code, attemptKey } },
    },
    { idempotencyKey: `sponsorship-checkout-${attemptKey}` }
  );
}

/** Idempotent order persistence: one order per attempt key / session. */
async function ensureOrderForAttempt(
  db: DbLike,
  args: {
    attemptKey: string;
    tierCode: string;
    amountCents: number;
    estimatedPounds: number;
    termsVersion: string;
    publicRef: string;
    sessionId: string;
  }
): Promise<void> {
  const byAttempt = await db
    .select({ id: sponsorshipOrders.id })
    .from(sponsorshipOrders)
    .where(eq(sponsorshipOrders.checkoutAttemptKey, args.attemptKey))
    .limit(1)
    .catch(() => []);
  if (byAttempt.length > 0) return;
  const bySession = await db
    .select({ id: sponsorshipOrders.id })
    .from(sponsorshipOrders)
    .where(eq(sponsorshipOrders.stripeCheckoutSessionId, args.sessionId))
    .limit(1)
    .catch(() => []);
  if (bySession.length > 0) return;
  try {
    await db.insert(sponsorshipOrders).values({
      publicRef: args.publicRef,
      stripeCheckoutSessionId: args.sessionId,
      stripePaymentIntentId: null,
      tierCode: args.tierCode,
      amountCents: args.amountCents,
      currency: "usd",
      estimatedPounds: args.estimatedPounds,
      sponsorDisplayName: null,
      sponsorEmail: null,
      status: "pending",
      allocatedRequestId: null,
      checkoutAttemptKey: args.attemptKey,
      termsVersion: args.termsVersion,
      termsAcceptedAt: new Date(),
    });
  } catch (err) {
    // Unique race (attempt or session already persisted) -> safe to reuse.
    // Any other persistence failure must propagate so the retry stays
    // retryable and the order is never silently lost.
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate|unique/i.test(msg)) return;
    throw err;
  }
}
