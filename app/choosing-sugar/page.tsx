import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { CopyInquiryButton } from "./copy-button";

export const metadata = {
  title: "Choosing Sugar",
  description: "Product-specific guidance for checking sugar processing for temple offerings and community meals.",
};

const INQUIRY_TEMPLATE =
  "Hello, our temple is reviewing sugar for use in religious offerings and community meals. Could you confirm whether [product name and package size] is processed using bone char or any other animal-derived processing aids? If the answer depends on the manufacturing facility or lot, please explain how we can identify a suitable package. Thank you.";

export default function ChoosingSugarPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>Choosing sugar</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Know what to look for.</h1>
      <p className="mt-5 text-lg leading-relaxed text-[#4A4238]">
        Some cane-sugar refining uses bone char—a granular filtering material made from animal
        bones—to remove color. It is a processing aid, not an ingredient in finished sugar. Because
        methods vary by manufacturer and product, always check the specific package and confirm with
        the manufacturer when information is unclear.{" "}
        <a className="source-link" href="https://www.epa.gov/sites/default/files/2020-10/documents/c9s10-1a.pdf" target="_blank" rel="noopener noreferrer">
          Source: EPA, Sugarcane Processing [PDF]
        </a>
      </p>

      <div className="mt-8 rounded-2xl border border-[#D8CCB8] bg-white p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-bold">The campaign standard</h2>
        <p className="mt-3 text-lg leading-relaxed">
          For this campaign, we seek sugar documented as processed without animal-derived
          processing aids.
        </p>
        <p className="mt-3 leading-relaxed text-[#4A4238]">
          Domino Foods notes it uses natural charcoal (bone char) for decolorization at specific
          refineries,{" "}
          <a className="source-link" href="https://asr-group.com/sites/default/files/2026-01/BSE-TSE%20Statement%20-%20DFI%20Web.pdf" target="_blank" rel="noopener noreferrer">
            Source: Domino Foods statement [PDF]
          </a>{" "}
          while its turbinado sugar “is made without using natural charcoal as a filter and is
          vegan.”{" "}
          <a className="source-link" href="https://www.dominosugar.com/baking-tips-how-tos/turbinado-faq" target="_blank" rel="noopener noreferrer">
            Source: Domino Turbinado FAQs
          </a>{" "}
          Wholesome Sweeteners states all of its sugar products are vegan and not processed through
          bone or animal by-products.{" "}
          <a className="source-link" href="https://wholesomesweet.com/pages/faq" target="_blank" rel="noopener noreferrer">
            Source: Wholesome FAQs
          </a>
        </p>
      </div>

      <h2 className="mt-10 text-2xl font-bold sm:text-3xl">Product-checking checklist</h2>
      <ol className="mt-4 divide-y divide-[#E5DCCB] border-y border-[#E5DCCB]">
        {[
          { t: "Identify the exact product.", d: "Record the manufacturer, product name, and package size—not just the retailer. Processing can differ between products, facilities, and time periods." },
          { t: "Look for clear documentation.", d: "Review product-specific vegan labeling or manufacturer information. Certification programs such as Vegan Action require manufacturer documentation for sweeteners. (Source: Vegan Action FAQs.)" },
          { t: "Contact the manufacturer if unclear.", d: "Use the inquiry template below. Keep the written response and the date checked with your purchasing records." },
          { t: "Recheck when things change.", d: "Reconfirm when the product, packaging, supplier, or manufacturer statement changes." },
        ].map((step, i) => (
          <li key={step.t} className="grid grid-cols-[3rem_1fr] gap-4 py-5">
            <span className="font-heading text-3xl font-bold text-terracotta-deeper" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h3 className="font-heading text-lg font-bold">{step.t}</h3>
              <p className="mt-1 text-[16px] leading-relaxed text-[#4A4238]">{step.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-[#6B5E4F]">
        Certification reference:{" "}
        <a className="source-link" href="https://vegan.org/certification/certification-faqs" target="_blank" rel="noopener noreferrer">
          Vegan Action Certification FAQs
        </a>
      </p>

      <h2 className="mt-10 text-2xl font-bold sm:text-3xl">Manufacturer inquiry template</h2>
      <p className="mt-3 leading-relaxed text-[#4A4238]">
        Copy and adapt this message when writing to a manufacturer. Replace the bracketed text
        with the exact product name and package size.
      </p>
      <div className="mt-4 rounded-2xl border border-[#E5DCCB] bg-white p-6">
        <p className="whitespace-pre-line leading-relaxed">{INQUIRY_TEMPLATE}</p>
        <div className="mt-4">
          <CopyInquiryButton text={INQUIRY_TEMPLATE} />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-[#D8A679] bg-[#FFF8EF] p-5 leading-relaxed" role="note">
        <h2 className="font-heading text-xl font-bold">Limitations</h2>
        <p className="mt-2">
          This guide supports purchasing decisions; it does not certify products. Product
          information may change. We do not publish an approved-product list because
          processing methods can differ between products, facilities, and time periods. Appearance
          alone cannot establish how sugar was processed.
        </p>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/request-sugar"
          className="inline-block rounded-full border border-terracotta-deeper px-8 py-3.5 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
        >
          Request Sugar for Your Temple
        </Link>
        <p className="mt-3 text-sm text-[#6B5E4F]">Requests are reviewed individually; donations are not guaranteed.</p>
      </div>
    </div>
  );
}
