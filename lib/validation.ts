import { z } from "zod";

const stateCodes = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","New Hampshire","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"] as const;

function isValidState(v: string) {
  const codes = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  return codes.includes(v);
}

// Date-only helper: expect YYYY-MM-DD, no timezone shift.
export function parseDateOnly(value: string | undefined | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function todayDateOnlyUTC(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const optionalUrl = z
  .string()
  .trim()
  .max(300, "Website must be 300 characters or fewer.")
  .optional()
  .or(z.literal(""))
  .refine(
    (v) => !v || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v),
    "Enter a valid http(s) URL, for example https://temple.org."
  );

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email must be 254 characters or fewer.")
  .email("Enter a valid email address.");

export const donationRequestSchema = z
  .object({
    // honeypot
    company: z.string().max(100).optional().default(""),
    idempotencyKey: z.string().trim().min(8).max(64),
    templeName: z.string().trim().min(2, "Temple name is required.").max(200),
    templeWebsite: optionalUrl,
    streetAddress: z.string().trim().min(3, "Street address is required.").max(200),
    addressLine2: z.string().trim().max(200).optional().default(""),
    city: z.string().trim().min(2, "City is required.").max(120),
    state: z.string().trim().length(2, "Select a state.").refine(isValidState, "Select a valid US state."),
    zipCode: z
      .string()
      .trim()
      .min(1, "ZIP code is required.")
      .max(10)
      .regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code."),
    contactName: z.string().trim().min(2, "Full name is required.").max(150),
    contactRole: z.string().trim().min(2, "Role at temple is required.").max(150),
    contactEmail: emailSchema,
    contactPhone: z.string().trim().max(30).optional().default(""),
    preferredContact: z.enum(["email", "phone"], { required_error: "Choose a preferred contact method." }),
    authorized: z.literal(true, { errorMap: () => ({ message: "Confirmation of authorization is required." }) }),
    quantityPounds: z.coerce
      .number({ invalid_type_error: "Enter a quantity in pounds." })
      .positive("Quantity must be more than zero.")
      .max(2000, "Requests are limited to 2,000 pounds per submission.")
      .refine((n) => Number.isFinite(n), "Enter a quantity in pounds."),
    dateNeeded: z.string().trim().max(10).optional().default(""),
    intendedUse: z
      .array(z.enum(["prasadam", "offerings", "meals", "festival", "other"]))
      .min(1, "Select at least one intended use."),
    otherUseExplanation: z.string().trim().max(500).optional().default(""),
    currentProduct: z.string().trim().max(300).optional().default(""),
    productPreferences: z.string().trim().max(1000).optional().default(""),
    deliveryInstructions: z.string().trim().max(1000).optional().default(""),
    additionalNotes: z.string().trim().max(2000).optional().default(""),
    understandsNoGuarantee: z.literal(true, {
      errorMap: () => ({ message: "Please acknowledge that submission does not guarantee approval or delivery." }),
    }),
    privacyConsent: z.literal(true, {
      errorMap: () => ({ message: "Privacy consent is required." }),
    }),
    // Part 3A: optional public-directory opt-in. Unchecked by default.
    // Only consent is accepted from public submissions; listing status is
    // derived server-side (pending_review vs private) and can never be set
    // to "published" except by an authenticated admin.
    publicListingConsent: z.boolean().optional().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.preferredContact === "phone" && !v.contactPhone?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactPhone"], message: "Phone is required when phone is the preferred contact method." });
    }
    if (v.intendedUse.includes("other") && !v.otherUseExplanation?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherUseExplanation"], message: "Please explain the other intended use." });
    }
    if (v.dateNeeded) {
      const parsed = parseDateOnly(v.dateNeeded);
      if (!parsed) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateNeeded"], message: "Enter the date as YYYY-MM-DD." });
      } else {
        const today = todayDateOnlyUTC();
        if (v.dateNeeded < today) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateNeeded"], message: "Date needed cannot be in the past." });
        }
      }
    }
  });

export type DonationRequestInput = z.infer<typeof donationRequestSchema>;

export const supportOfferSchema = z.object({
  company: z.string().max(100).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(64),
  name: z.string().trim().min(2, "Name is required.").max(150),
  email: emailSchema,
  organization: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  state: z.string().trim().max(2).optional().default(""),
  supportType: z.enum(["donate_sugar", "coordinate", "introduce", "volunteer", "other"], {
    required_error: "Choose how you would like to help.",
  }),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(2000),
  privacyConsent: z.literal(true, { errorMap: () => ({ message: "Privacy consent is required." }) }),
});

export type SupportOfferInput = z.infer<typeof supportOfferSchema>;

export const contactSchema = z.object({
  company: z.string().max(100).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(64),
  name: z.string().trim().min(2, "Name is required.").max(150),
  email: emailSchema,
  subject: z.string().trim().min(3, "Subject is required.").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(3000),
  privacyConsent: z.literal(true, { errorMap: () => ({ message: "Privacy consent is required." }) }),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const adminStatusSchema = z.object({
  status: z.enum(["submitted", "under_review", "needs_information", "approved", "ordered", "delivered", "declined", "withdrawn"]),
  deliveryNotes: z.string().trim().max(2000).optional().default(""),
});

export const adminNoteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty.").max(2000),
});

// Admin-only: short plain-text public note shown on /temples. Sanitized
// (no HTML/URLs with schemes stripped at render) and length-bounded.
export const adminListingSummarySchema = z.object({
  summary: z
    .string()
    .trim()
    .max(240, "Summary must be 240 characters or fewer.")
    .optional()
    .default(""),
});

export const adminListingActionSchema = z.object({
  action: z.enum(["publish", "unpublish"]),
});

// Part 3B: public sponsorship checkout. Tier code is the only pricing input;
// amounts are resolved server-side. Terms acknowledgement is required.
export const sponsorshipCheckoutSchema = z.object({
  tierCode: z.enum(["bag_10", "bag_25", "bag_50", "bag_100"], {
    required_error: "Choose a sponsorship tier.",
  }),
  sponsorDisplayName: z.string().trim().max(80, "Display name must be 80 characters or fewer.").optional().default(""),
  publicRecognitionConsent: z.boolean().optional().default(false),
  acknowledgesTerms: z.literal(true, {
    errorMap: () => ({ message: "Please acknowledge the sponsorship terms before continuing." }),
  }),
});

export type SponsorshipCheckoutInput = z.infer<typeof sponsorshipCheckoutSchema>;

// Part 3B: admin fulfillment-ledger entry (private fields stay server-side).
export const fulfillmentEntrySchema = z.object({
  recipientLabel: z.string().trim().min(2, "Recipient label is required.").max(200),
  city: z.string().trim().max(120).optional().default(""),
  state: z.string().trim().max(2).optional().default(""),
  poundsDelivered: z.coerce.number({ invalid_type_error: "Enter pounds delivered." }).int().positive("Pounds must be more than zero.").max(100000),
  sugarProductLabel: z.string().trim().min(2, "Product label is required.").max(300),
  deliveredAt: z.string().trim().min(1, "Delivery date is required.").max(30),
  publicVisible: z.boolean().optional().default(false),
  internalNotes: z.string().trim().max(2000).optional().default(""),
  donationRequestId: z.string().trim().max(64).optional().default(""),
  sponsorshipOrderId: z.string().trim().max(64).optional().default(""),
});

export type FulfillmentEntryInput = z.infer<typeof fulfillmentEntrySchema>;

export const fulfillmentVisibilitySchema = z.object({
  entryId: z.string().trim().min(1, "Entry is required."),
  publicVisible: z.enum(["true", "false"]),
});

export function flattenZodErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function isValidStateExport(v: string) {
  return isValidState(v);
}
