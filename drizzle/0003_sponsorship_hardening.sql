-- Part 3B hardening: retry-safe checkout attempts, Stripe event idempotency,
-- partial-refund tracking, terms acceptance, and repeat-safe ledger writes.
-- Additive, reversible, safe for existing production data:
--   - new tables only for attempts + processed Stripe events
--   - new nullable/unique-with-nulls columns; existing rows backfill safely
--   - IF NOT EXISTS / IF EXISTS guards make the migration idempotent
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsorship_checkout_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_key" varchar(64) NOT NULL UNIQUE,
  "tier_code" varchar(32) NOT NULL,
  "terms_version" varchar(16) DEFAULT 'v1' NOT NULL,
  "sponsor_display_name" text,
  "stripe_session_id" text UNIQUE,
  "stripe_session_url" text,
  "public_ref" varchar(20),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsorship_stripe_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stripe_event_id" text NOT NULL UNIQUE,
  "order_id" uuid REFERENCES "sponsorship_orders"("id") ON DELETE SET NULL,
  "event_type" varchar(64) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsorship_orders" ADD COLUMN IF NOT EXISTS "checkout_attempt_key" varchar(64);
--> statement-breakpoint
ALTER TABLE "sponsorship_orders" ADD COLUMN IF NOT EXISTS "terms_version" varchar(16) DEFAULT 'v1' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sponsorship_orders" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "sponsorship_orders" ADD COLUMN IF NOT EXISTS "refunded_amount_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sponsorship_orders_attempt_key_uidx" ON "sponsorship_orders" ("checkout_attempt_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorship_attempts_created_idx" ON "sponsorship_checkout_attempts" ("created_at");
--> statement-breakpoint
ALTER TABLE "fulfillment_ledger" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fulfillment_ledger_idempotency_uidx" ON "fulfillment_ledger" ("idempotency_key");
-- Down migration (reversible; run manually if the hardening is rolled back):
-- DROP INDEX IF EXISTS "fulfillment_ledger_idempotency_uidx";
-- ALTER TABLE "fulfillment_ledger" DROP COLUMN IF EXISTS "idempotency_key";
-- DROP INDEX IF EXISTS "sponsorship_attempts_created_idx";
-- DROP INDEX IF EXISTS "sponsorship_orders_attempt_key_uidx";
-- ALTER TABLE "sponsorship_orders" DROP COLUMN IF EXISTS "refunded_amount_cents";
-- ALTER TABLE "sponsorship_orders" DROP COLUMN IF EXISTS "terms_accepted_at";
-- ALTER TABLE "sponsorship_orders" DROP COLUMN IF EXISTS "terms_version";
-- ALTER TABLE "sponsorship_orders" DROP COLUMN IF EXISTS "checkout_attempt_key";
-- DROP TABLE IF EXISTS "sponsorship_stripe_events";
-- DROP TABLE IF EXISTS "sponsorship_checkout_attempts";
