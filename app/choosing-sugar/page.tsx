import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { CopyInquiryButton } from "./copy-button";

export const metadata = {
  title: "Choosing Sugar",
  description: "Product-specific guidance for choosing sugar for temple offerings and community meals.",
};

const INQUIRY_TEMPLATE =
  "Hello, our temple is reviewing sugar for use in religious offerings and community meals. Could you confirm whether [product name and package size] is processed using bone char or any other animal-derived processing aids? If the answer depends on the manufacturing facility or lot, please explain how we can identify a suitable package. Thank you.";

export default function ChoosingSugarPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>Choosing sugar</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Know what to look for.</h1>
      <p className="mt-5 text-lg leading-relaxed text-[#4A4238]">
        Sugar-processing methods can vary by manufacturer and product. This initiative encourages
        temples to check product-specific labeling and manufacturer information when choosing sugar.
      </p>

      <Card className="mt-8 border-terracotta-deeper/30">
        <h2 className="text-2xl font-bold">The initiative&apos;s standard</h2>
        <p className="mt-3 text-lg leading-relaxed">
          For this initiative, we seek sugar documented as processed without animal-derived
          processing aids.
        </p>
      </Card>

      <h2 className="mt-10 text-2xl font-bold sm:text-3xl">Product-checking checklist</h2>
      <ol className="mt-4 space-y-3">
        {[
          "Identify the exact product and manufacturer.",
          "Look for explicit product-specific vegan labeling or documentation.",
          "Contact the manufacturer if the information is unclear.",
          "Keep the response and the date checked.",
          "Recheck when products or manufacturing information change.",
        ].map((step, i) => (
          <li key={step} className="flex gap-4 rounded-2xl border border-[#E5DCCB] bg-white p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-soft font-heading font-bold text-terracotta-deeper" aria-hidden="true">
              {i + 1}
            </span>
            <span className="text-[16px] leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-2xl font-bold sm:text-3xl">Manufacturer inquiry template</h2>
      <p className="mt-3 leading-relaxed text-[#4A4238]">
        Copy and adapt this message when writing to a manufacturer. Replace the bracketed text
        with the exact product name and package size.
      </p>
      <Card className="mt-4">
        <p className="whitespace-pre-line leading-relaxed">{INQUIRY_TEMPLATE}</p>
        <div className="mt-4">
          <CopyInquiryButton text={INQUIRY_TEMPLATE} />
        </div>
      </Card>

      <div className="mt-8 rounded-2xl border border-[#D8A679] bg-[#FFF8EF] p-5 leading-relaxed" role="note">
        <h2 className="font-heading text-xl font-bold">Limitations</h2>
        <p className="mt-2">
          This guide supports purchasing decisions; it does not certify products. Product
          information may change. We do not publish an approved-product list because
          processing methods can differ between products, facilities, and time periods.
        </p>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/request-sugar"
          className="inline-block rounded-full bg-terracotta-deeper px-8 py-3.5 font-semibold text-white hover:bg-[#7E3B1E]"
        >
          Request a Sugar Donation
        </Link>
      </div>
    </div>
  );
}
