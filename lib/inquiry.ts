export type InquiryFields = {
  brand: string;
  productName: string;
  packageSize: string;
  countryRegion: string;
  retailer: string;
  facilityLot: string;
};

export const EMPTY_INQUIRY_FIELDS: InquiryFields = {
  brand: "",
  productName: "",
  packageSize: "",
  countryRegion: "",
  retailer: "",
  facilityLot: "",
};

export const INQUIRY_LIMITS: Record<keyof InquiryFields, number> = {
  brand: 120,
  productName: 200,
  packageSize: 80,
  countryRegion: 120,
  retailer: 120,
  facilityLot: 120,
};

export function sanitizeInquiryField(value: string, max: number): string {
  // Single-line optional fields: collapse newlines/tabs to spaces, trim, bound length.
  // Preserves punctuation and Unicode; never interprets input as HTML.
  const collapsed = value.replace(/[\r\n\t]+/g, " ").trim().replace(/\s{2,}/g, " ");
  return collapsed.slice(0, max);
}

export function sanitizeInquiryFields(input: Partial<InquiryFields>): InquiryFields {
  return {
    brand: sanitizeInquiryField(input.brand ?? "", INQUIRY_LIMITS.brand),
    productName: sanitizeInquiryField(input.productName ?? "", INQUIRY_LIMITS.productName),
    packageSize: sanitizeInquiryField(input.packageSize ?? "", INQUIRY_LIMITS.packageSize),
    countryRegion: sanitizeInquiryField(input.countryRegion ?? "", INQUIRY_LIMITS.countryRegion),
    retailer: sanitizeInquiryField(input.retailer ?? "", INQUIRY_LIMITS.retailer),
    facilityLot: sanitizeInquiryField(input.facilityLot ?? "", INQUIRY_LIMITS.facilityLot),
  };
}

function describeOrBlank(value: string, placeholder: string): string {
  return value ? value : placeholder;
}

export function buildInquirySubject(fields: InquiryFields): string {
  const clean = sanitizeInquiryFields(fields);
  const product = clean.productName || clean.brand;
  if (product) return `Question about sugar processing for ${product}`;
  return "Question about sugar processing aids";
}

export function buildInquiryDraft(fields: InquiryFields, guideUrl: string): string {
  const clean = sanitizeInquiryFields(fields);
  const lines: string[] = [];
  lines.push("Hello,");
  lines.push("");
  lines.push(
    "Our temple is reviewing sugar for use in religious offerings and community meals. Could you help us confirm processing information for one specific product?"
  );
  lines.push("");
  lines.push("Product details (exactly as listed on our package):");
  lines.push(`- Brand / manufacturer: ${describeOrBlank(clean.brand, "[brand / manufacturer]")}`);
  lines.push(`- Exact product name: ${describeOrBlank(clean.productName, "[exact product name]")}`);
  lines.push(`- Package size: ${describeOrBlank(clean.packageSize, "[package size, for example 4 lb / 1.81 kg]")}`);
  lines.push(`- Country / region of purchase: ${describeOrBlank(clean.countryRegion, "[country / region, if known]")}`);
  lines.push(`- Retailer: ${describeOrBlank(clean.retailer, "[retailer, if known]")}`);
  lines.push(
    `- Facility / lot code on package: ${describeOrBlank(clean.facilityLot, "[facility / lot code, if shown]")}`
  );
  lines.push("");
  lines.push("Could you please confirm:");
  lines.push("1. Whether this specific product uses animal-derived processing aids, including bone char.");
  lines.push("2. Whether processing differs by facility, supplier, region, or lot for this product.");
  lines.push("3. How we can identify the applicable facility or product from the package markings.");
  lines.push("4. Where we can find current written documentation for this product.");
  lines.push("");
  lines.push(
    "If the answer depends on the facility or lot, please explain how we can identify a suitable package."
  );
  if (guideUrl) {
    lines.push("");
    lines.push(`The guide we are using: ${guideUrl}`);
  }
  lines.push("");
  lines.push("Thank you for your help.");
  return lines.join("\n");
}

export function buildInquiryMailto(fields: InquiryFields, guideUrl: string): string {
  // No recipient address: the visitor chooses where to send. Never auto-sends.
  const subject = buildInquirySubject(fields);
  const body = buildInquiryDraft(fields, guideUrl);
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
