-- Part 3A: opt-in public temple directory columns on donation_requests.
-- Additive, reversible, safe for existing production data:
--   - all existing rows keep strictly-private behavior via defaults
--     (consent false, status "private", nullable columns stay NULL)
--   - IF NOT EXISTS / IF EXISTS guards make the migration idempotent
-- Down migration: run the DROP statements in the footer comment.
--> statement-breakpoint
ALTER TABLE "donation_requests" ADD COLUMN IF NOT EXISTS "public_listing_consent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "donation_requests" ADD COLUMN IF NOT EXISTS "public_listing_consent_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "donation_requests" ADD COLUMN IF NOT EXISTS "public_listing_status" varchar(24) DEFAULT 'private' NOT NULL;
--> statement-breakpoint
ALTER TABLE "donation_requests" ADD COLUMN IF NOT EXISTS "public_listing_summary" text;
--> statement-breakpoint
ALTER TABLE "donation_requests" ADD COLUMN IF NOT EXISTS "public_listing_reviewed_by" text;
--> statement-breakpoint
ALTER TABLE "donation_requests" ADD COLUMN IF NOT EXISTS "public_listing_reviewed_at" timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donation_requests_public_listing_status_idx" ON "donation_requests" ("public_listing_status");
-- Down migration (reversible; run manually if the feature is rolled back):
-- DROP INDEX IF EXISTS "donation_requests_public_listing_status_idx";
-- ALTER TABLE "donation_requests" DROP COLUMN IF EXISTS "public_listing_reviewed_at";
-- ALTER TABLE "donation_requests" DROP COLUMN IF EXISTS "public_listing_reviewed_by";
-- ALTER TABLE "donation_requests" DROP COLUMN IF EXISTS "public_listing_summary";
-- ALTER TABLE "donation_requests" DROP COLUMN IF EXISTS "public_listing_status";
-- ALTER TABLE "donation_requests" DROP COLUMN IF EXISTS "public_listing_consent_at";
-- ALTER TABLE "donation_requests" DROP COLUMN IF EXISTS "public_listing_consent";
