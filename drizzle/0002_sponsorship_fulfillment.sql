-- Part 3B: sponsorship orders + fulfillment transparency ledger.
-- Additive, reversible, safe for existing production data:
--   - new tables only; existing tables untouched
--   - IF NOT EXISTS / IF EXISTS guards make the migration idempotent
-- Down migration: run the DROP statements in the footer comment.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsorship_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_ref" varchar(20) NOT NULL UNIQUE,
  "stripe_checkout_session_id" text NOT NULL UNIQUE,
  "stripe_payment_intent_id" text,
  "tier_code" varchar(32) NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'usd' NOT NULL,
  "estimated_pounds" integer NOT NULL,
  "sponsor_display_name" text,
  "sponsor_email" text,
  "public_recognition_consent" boolean DEFAULT false NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "allocated_request_id" uuid REFERENCES "donation_requests"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "paid_at" timestamptz,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorship_orders_status_idx" ON "sponsorship_orders" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorship_orders_created_idx" ON "sponsorship_orders" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fulfillment_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_ref" varchar(20) NOT NULL UNIQUE,
  "donation_request_id" uuid REFERENCES "donation_requests"("id") ON DELETE SET NULL,
  "sponsorship_order_id" uuid REFERENCES "sponsorship_orders"("id") ON DELETE SET NULL,
  "recipient_label" text NOT NULL,
  "city" text,
  "state" varchar(2),
  "pounds_delivered" integer NOT NULL,
  "sugar_product_label" text NOT NULL,
  "delivered_at" timestamptz NOT NULL,
  "recorded_by" text NOT NULL,
  "internal_notes" text,
  "public_visible" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillment_ledger_public_visible_idx" ON "fulfillment_ledger" ("public_visible");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillment_ledger_delivered_at_idx" ON "fulfillment_ledger" ("delivered_at");
-- Down migration (reversible; run manually if the feature is rolled back):
-- DROP INDEX IF EXISTS "fulfillment_ledger_delivered_at_idx";
-- DROP INDEX IF EXISTS "fulfillment_ledger_public_visible_idx";
-- DROP TABLE IF EXISTS "fulfillment_ledger";
-- DROP INDEX IF EXISTS "sponsorship_orders_created_idx";
-- DROP INDEX IF EXISTS "sponsorship_orders_status_idx";
-- DROP TABLE IF EXISTS "sponsorship_orders";
