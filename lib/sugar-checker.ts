export type SugarCategoryId =
  | "organic-cane"
  | "beet"
  | "turbinado-raw"
  | "conventional-refined"
  | "jaggery"
  | "unknown-mixed";

export type CheckerSource = { label: string; href: string };

export type CheckerResult = {
  categoryId: SugarCategoryId;
  heading: string;
  explanation: string;
  verify: string[];
  limitation: string;
  sources: CheckerSource[];
};

export const SUGAR_CATEGORIES: { id: SugarCategoryId; label: string; hint: string }[] = [
  {
    id: "organic-cane",
    label: "Certified organic cane sugar",
    hint: "Package mentions organic certification.",
  },
  {
    id: "beet",
    label: "Beet sugar",
    hint: "Package names beet as the source.",
  },
  {
    id: "turbinado-raw",
    label: "Turbinado / raw cane sugar",
    hint: "Golden or coarse crystals, minimally refined.",
  },
  {
    id: "conventional-refined",
    label: "Conventional refined white cane sugar",
    hint: "Standard white granulated sugar.",
  },
  {
    id: "jaggery",
    label: "Jaggery / gur",
    hint: "Traditional concentrated cane product.",
  },
  {
    id: "unknown-mixed",
    label: "Unknown or mixed ingredients",
    hint: "Source unclear, mixed sugars, or food-service bag.",
  },
];

export const EPA_SOURCE: CheckerSource = {
  label: "EPA: Sugarcane Processing [PDF]",
  href: "https://www.epa.gov/sites/default/files/2020-10/documents/c9s10-1a.pdf",
};

export const DOMINO_STATEMENT_SOURCE: CheckerSource = {
  label: "Domino Foods statement [PDF]",
  href: "https://asr-group.com/sites/default/files/2026-01/BSE-TSE%20Statement%20-%20DFI%20Web.pdf",
};

export const DOMINO_TURBINADO_SOURCE: CheckerSource = {
  label: "Domino Turbinado FAQs",
  href: "https://www.dominosugar.com/baking-tips-how-tos/turbinado-faq",
};

export const WHOLESOME_SOURCE: CheckerSource = {
  label: "Wholesome FAQs",
  href: "https://wholesomesweet.com/pages/faq",
};

export const VEGAN_ACTION_SOURCE: CheckerSource = {
  label: "Vegan Action Certification FAQs",
  href: "https://vegan.org/certification/certification-faqs",
};

const RESULTS: Record<SugarCategoryId, CheckerResult> = {
  "organic-cane": {
    categoryId: "organic-cane",
    heading: "Organic cane sugar: check this product's filtering information.",
    explanation:
      "An organic label describes farming and handling standards. It does not by itself document whether animal-derived filtering aids were used for this product, so treat it as a starting point and check product-specific information.",
    verify: [
      "Read the exact package for vegan labeling or a written processing statement.",
      "Check the maker's current product page or written statement for this product name and package size.",
      "If the package and maker statement do not answer the filtering question, confirm with the manufacturer using the inquiry draft below.",
    ],
    limitation:
      "Do not treat an organic label alone as proof of how the sugar was filtered. Processing can differ by product, facility, and time period.",
    sources: [VEGAN_ACTION_SOURCE, WHOLESOME_SOURCE],
  },
  beet: {
    categoryId: "beet",
    heading: "Beet sugar: confirm the source on this exact package.",
    explanation:
      "Bone-char filtering is documented in cane-sugar refining. The practical question for a beet-labeled bag is whether this exact package identifies beet as the source and excludes mixed sources.",
    verify: [
      "Check whether the exact package names beet as the source.",
      "Look for product-specific vegan labeling or manufacturer information for this product.",
      "If the source is unclear, mixed, or the bag is from food service, confirm with the manufacturer.",
    ],
    limitation:
      "Do not assume every bag from a brand or retailer is beet. Mixed or repackaged sources need a manufacturer check, and appearance alone cannot establish processing.",
    sources: [EPA_SOURCE, VEGAN_ACTION_SOURCE],
  },
  "turbinado-raw": {
    categoryId: "turbinado-raw",
    heading: "Turbinado / raw cane sugar: one product's statement does not cover all.",
    explanation:
      "Filtering varies by product. Domino Foods states that its turbinado sugar \u201cis made without using natural charcoal as a filter and is vegan,\u201d while noting it uses natural charcoal (bone char) for decolorization at specific refineries for other products.",
    verify: [
      "Read the exact package for vegan labeling or a processing statement.",
      "Check this maker's current statement for this product name, not a different product in the same brand.",
      "If the statement does not cover this product or package, confirm with the manufacturer.",
    ],
    limitation:
      "Do not extend one turbinado product's statement to all raw, natural, or golden sugars. Check the specific product and recheck when packaging or statements change.",
    sources: [DOMINO_TURBINADO_SOURCE, DOMINO_STATEMENT_SOURCE, VEGAN_ACTION_SOURCE],
  },
  "conventional-refined": {
    categoryId: "conventional-refined",
    heading: "Conventional refined cane sugar: this is where a manufacturer check matters most.",
    explanation:
      "Bone-char filtering is documented for some cane refining. Domino Foods notes it uses natural charcoal (bone char) for decolorization at specific refineries, and methods vary by manufacturer and product.",
    verify: [
      "Record the manufacturer, product name, and package size from the exact bag.",
      "Look for product-specific vegan labeling or a current manufacturer statement for this product.",
      "When the answer is unclear, contact the manufacturer with the inquiry draft below and keep the written response with the date checked.",
    ],
    limitation:
      "Do not judge filtering by crystal color or store name. Processing can differ between products, facilities, and time periods, so product-specific documentation is needed.",
    sources: [DOMINO_STATEMENT_SOURCE, EPA_SOURCE, VEGAN_ACTION_SOURCE],
  },
  jaggery: {
    categoryId: "jaggery",
    heading: "Jaggery / gur: check this maker's processing information.",
    explanation:
      "Jaggery is a concentrated cane product that is generally less refined than white sugar. Filtering and handling still vary by maker, and written labeling may be limited, so check what this specific product documents.",
    verify: [
      "Read the exact package for ingredients, source, and any vegan or processing statement.",
      "Check the maker's current product information for this product name and package size.",
      "If labeling is limited or unclear, confirm with the manufacturer and keep the response with the date checked.",
    ],
    limitation:
      "Do not assume all jaggery products share the same processing. Small makers may have limited written documentation; keep what you can verify and recheck when the product or supplier changes.",
    sources: [EPA_SOURCE, VEGAN_ACTION_SOURCE],
  },
  "unknown-mixed": {
    categoryId: "unknown-mixed",
    heading: "Unknown or mixed: there is not enough information on the package alone.",
    explanation:
      "When the sugar source is unclear, the bag lists mixed sugars, or the sugar comes from a food-service container, the package alone does not answer the filtering question. Treat this as a \u201cconfirm with the manufacturer\u201d case.",
    verify: [
      "Write down the exact product name, package size, and any facility or lot markings from the bag.",
      "Use the manufacturer inquiry draft below and keep the written response with the date checked.",
      "Recheck when the product, packaging, supplier, or manufacturer statement changes.",
    ],
    limitation:
      "Package color, crystal size, brand familiarity, or store name alone cannot establish how sugar was processed. Product-specific documentation is needed.",
    sources: [VEGAN_ACTION_SOURCE, EPA_SOURCE],
  },
};

export function getCategoryIds(): SugarCategoryId[] {
  return SUGAR_CATEGORIES.map((c) => c.id);
}

export function getCheckerResult(categoryId: SugarCategoryId): CheckerResult {
  return RESULTS[categoryId];
}

export function isValidCategoryId(value: string): value is SugarCategoryId {
  return (SUGAR_CATEGORIES as { id: string }[]).some((c) => c.id === value);
}
