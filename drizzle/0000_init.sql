--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "donation_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_ref" varchar(16) NOT NULL UNIQUE,
  "idempotency_key" varchar(64) NOT NULL UNIQUE,
  "temple_name" text NOT NULL,
  "temple_website" text,
  "street_address" text NOT NULL,
  "address_line2" text,
  "city" text NOT NULL,
  "state" varchar(2) NOT NULL,
  "zip_code" varchar(10) NOT NULL,
  "country" varchar(2) DEFAULT 'US' NOT NULL,
  "contact_name" text NOT NULL,
  "contact_role" text NOT NULL,
  "contact_email" text NOT NULL,
  "contact_phone" text,
  "preferred_contact" varchar(10) DEFAULT 'email' NOT NULL,
  "authorized" boolean DEFAULT false NOT NULL,
  "authorized_at" timestamptz,
  "quantity_pounds" integer NOT NULL,
  "date_needed" varchar(10),
  "intended_use" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "other_use_explanation" text,
  "current_product" text,
  "product_preferences" text,
  "delivery_instructions" text,
  "additional_notes" text,
  "understands_no_guarantee" boolean DEFAULT false NOT NULL,
  "privacy_consent" boolean DEFAULT false NOT NULL,
  "privacy_policy_version" varchar(16) DEFAULT 'v1' NOT NULL,
  "status" varchar(24) DEFAULT 'submitted' NOT NULL,
  "delivery_notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donation_requests_status_idx" ON "donation_requests" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donation_requests_created_idx" ON "donation_requests" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donation_requests_state_idx" ON "donation_requests" ("state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL REFERENCES "donation_requests"("id") ON DELETE CASCADE,
  "author_email" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "request_notes_request_idx" ON "request_notes" ("request_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL REFERENCES "donation_requests"("id") ON DELETE CASCADE,
  "from_status" varchar(24),
  "to_status" varchar(24) NOT NULL,
  "changed_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "status_history_request_idx" ON "request_status_history" ("request_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_ref" varchar(16) NOT NULL UNIQUE,
  "idempotency_key" varchar(64) NOT NULL UNIQUE,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "organization" text,
  "city" text,
  "state" varchar(2),
  "support_type" varchar(32) NOT NULL,
  "message" text NOT NULL,
  "privacy_consent" boolean DEFAULT false NOT NULL,
  "privacy_policy_version" varchar(16) DEFAULT 'v1' NOT NULL,
  "status" varchar(24) DEFAULT 'submitted' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_offers_created_idx" ON "support_offers" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_ref" varchar(16) NOT NULL UNIQUE,
  "idempotency_key" varchar(64) NOT NULL UNIQUE,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "privacy_consent" boolean DEFAULT false NOT NULL,
  "privacy_policy_version" varchar(16) DEFAULT 'v1' NOT NULL,
  "status" varchar(24) DEFAULT 'submitted' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_inquiries_created_idx" ON "contact_inquiries" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(160) NOT NULL,
  "window_start" timestamptz NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  UNIQUE("key", "window_start")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_prospects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "temple_name" text NOT NULL,
  "city" text,
  "state" varchar(2),
  "website" text,
  "contact_info" text,
  "outreach_status" varchar(32) DEFAULT 'not_contacted' NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_status_idx" ON "outreach_prospects" ("outreach_status");
