import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "needs_information",
  "approved",
  "ordered",
  "delivered",
  "declined",
  "withdrawn",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const PUBLIC_LISTING_STATUSES = [
  "private",
  "pending_review",
  "published",
  "unpublished",
] as const;

export type PublicListingStatus = (typeof PUBLIC_LISTING_STATUSES)[number];

export const PUBLIC_LISTING_SUMMARY_MAX_LENGTH = 240;

export const donationRequests = pgTable(
  "donation_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicRef: varchar("public_ref", { length: 16 }).notNull().unique(),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull().unique(),
    // Step 1: temple
    templeName: text("temple_name").notNull(),
    templeWebsite: text("temple_website"),
    streetAddress: text("street_address").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    zipCode: varchar("zip_code", { length: 10 }).notNull(),
    country: varchar("country", { length: 2 }).notNull().default("US"),
    // Step 2: contact
    contactName: text("contact_name").notNull(),
    contactRole: text("contact_role").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    preferredContact: varchar("preferred_contact", { length: 10 }).notNull().default("email"),
    authorized: boolean("authorized").notNull().default(false),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    // Step 3: needs
    quantityPounds: integer("quantity_pounds").notNull(),
    dateNeeded: varchar("date_needed", { length: 10 }),
    intendedUse: jsonb("intended_use").$type<string[]>().notNull().default([]),
    otherUseExplanation: text("other_use_explanation"),
    currentProduct: text("current_product"),
    productPreferences: text("product_preferences"),
    deliveryInstructions: text("delivery_instructions"),
    additionalNotes: text("additional_notes"),
    // Review consents
    understandsNoGuarantee: boolean("understands_no_guarantee").notNull().default(false),
    privacyConsent: boolean("privacy_consent").notNull().default(false),
    privacyPolicyVersion: varchar("privacy_policy_version", { length: 16 })
      .notNull()
      .default("v1"),
    // Workflow
    status: varchar("status", { length: 24 }).notNull().default("submitted"),
    // Optional public temple-directory listing (Part 3A). All existing rows
    // stay strictly private via safe defaults.
    publicListingConsent: boolean("public_listing_consent").notNull().default(false),
    publicListingConsentAt: timestamp("public_listing_consent_at", { withTimezone: true }),
    publicListingStatus: varchar("public_listing_status", { length: 24 }).notNull().default("private"),
    publicListingSummary: text("public_listing_summary"),
    publicListingReviewedBy: text("public_listing_reviewed_by"),
    publicListingReviewedAt: timestamp("public_listing_reviewed_at", { withTimezone: true }),
    deliveryNotes: text("delivery_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("donation_requests_status_idx").on(t.status),
    index("donation_requests_created_idx").on(t.createdAt),
    index("donation_requests_state_idx").on(t.state),
    index("donation_requests_public_listing_status_idx").on(t.publicListingStatus),
    uniqueIndex("donation_requests_public_ref_uidx").on(t.publicRef),
  ]
);

export const requestNotes = pgTable(
  "request_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => donationRequests.id, { onDelete: "cascade" }),
    authorEmail: text("author_email").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_notes_request_idx").on(t.requestId)]
);

export const statusHistory = pgTable(
  "request_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => donationRequests.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 24 }),
    toStatus: varchar("to_status", { length: 24 }).notNull(),
    changedBy: text("changed_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("status_history_request_idx").on(t.requestId)]
);

export const supportOffers = pgTable(
  "support_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicRef: varchar("public_ref", { length: 16 }).notNull().unique(),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    organization: text("organization"),
    city: text("city"),
    state: varchar("state", { length: 2 }),
    supportType: varchar("support_type", { length: 32 }).notNull(),
    message: text("message").notNull(),
    privacyConsent: boolean("privacy_consent").notNull().default(false),
    privacyPolicyVersion: varchar("privacy_policy_version", { length: 16 })
      .notNull()
      .default("v1"),
    status: varchar("status", { length: 24 }).notNull().default("submitted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_offers_created_idx").on(t.createdAt)]
);

export const contactInquiries = pgTable(
  "contact_inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicRef: varchar("public_ref", { length: 16 }).notNull().unique(),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    privacyConsent: boolean("privacy_consent").notNull().default(false),
    privacyPolicyVersion: varchar("privacy_policy_version", { length: 16 })
      .notNull()
      .default("v1"),
    status: varchar("status", { length: 24 }).notNull().default("submitted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_inquiries_created_idx").on(t.createdAt)]
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 160 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [uniqueIndex("rate_limits_key_window_uidx").on(t.key, t.windowStart)]
);

export const outreachProspects = pgTable(
  "outreach_prospects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templeName: text("temple_name").notNull(),
    city: text("city"),
    state: varchar("state", { length: 2 }),
    website: text("website"),
    contactInfo: text("contact_info"),
    outreachStatus: varchar("outreach_status", { length: 32 }).notNull().default("not_contacted"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outreach_status_idx").on(t.outreachStatus)]
);

export type DonationRequest = typeof donationRequests.$inferSelect;
export type SupportOffer = typeof supportOffers.$inferSelect;
export type ContactInquiry = typeof contactInquiries.$inferSelect;
