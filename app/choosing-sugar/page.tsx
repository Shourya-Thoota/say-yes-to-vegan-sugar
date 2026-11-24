import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { SugarChecker } from "./sugar-checker";
import { InquiryBuilder } from "./inquiry-builder";
import { getSiteBaseUrl } from "@/lib/poster";

export const metadata = {
  title: "Choosing Sugar",
  description: "Product-specific guidance for checking sugar processing for temple offerings and community meals.",
};

export default function ChoosingSugarPage() {
  const base = getSiteBaseUrl(process.env);
  const guideUrl = `${base}/choosing-sugar`;

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

      <section id="checker" aria-labelledby="checker-heading" className="mt-10 scroll-mt-24">
        <h2 id="checker-heading" className="text-2xl font-bold sm:text-3xl">
          Check your bag: a short guided helper.
        </h2>
        <p className="mt-3 leading-relaxed text-[#4A4238]">
          Work through your sugar one step at a time. This helper offers guidance only — it
          does not certify products and does not store anything you choose.
        </p>
        <SugarChecker />
        <noscript>
          <div className="mt-6 rounded-2xl border border-[#D8CCB8] bg-white p-6 leading-relaxed">
            <p className="font-bold">Without JavaScript, use these three steps:</p>
            <ol className="mt-2 list-decimal space-y-2 pl-6">
              <li>Write down the manufacturer, exact product name, and package size.</li>
              <li>Look for product-specific vegan labeling or a current manufacturer statement for that exact product.</li>
              <li>If the answer is unclear, use the inquiry wording on this page and keep the written reply with the date checked.</li>
            </ol>
            <p className="mt-3">
              Useful references:{" "}
              <a className="source-link" href="https://vegan.org/certification/certification-faqs" target="_blank" rel="noopener noreferrer">
                Vegan Action Certification FAQs
              </a>
              {"; "}
              <a className="source-link" href="https://www.dominosugar.com/baking-tips-how-tos/turbinado-faq" target="_blank" rel="noopener noreferrer">
                Domino Turbinado FAQs
              </a>
              .
            </p>
          </div>
        </noscript>
      </section>

      <div className="mt-8 rounded-2xl border border-[#D8CCB8] bg-[#EFE7D8] p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold">For the kitchen wall</h2>
        <p className="mt-2 leading-relaxed text-[#4A4238]">
          A one-page printable version of this checklist with write-in lines for your purchasing
          records.
        </p>
        <Link
          href="/poster"
          className="mt-4 inline-block min-h-[44px] rounded-xl bg-charcoal px-6 py-3 font-semibold text-white hover:bg-black"
        >
          Open the printable kitchen guide
        </Link>
      </div>

      <h2 id="checklist" className="mt-10 scroll-mt-24 text-2xl font-bold sm:text-3xl">Product-checking checklist</h2>
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

      <h2 id="inquiry" className="mt-10 scroll-mt-24 text-2xl font-bold sm:text-3xl">Manufacturer inquiry builder</h2>
      <p className="mt-3 leading-relaxed text-[#4A4238]">
        Fill in what you know — every field is optional — then copy the draft or open it
        in your email app. Nothing is sent automatically and nothing is stored.
      </p>
      <div className="mt-4 rounded-2xl border border-[#E5DCCB] bg-white p-6">
        <InquiryBuilder guideUrl={guideUrl} />
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
          className="inline-block min-h-[44px] rounded-xl border border-terracotta-deeper px-8 py-3.5 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
        >
          Request Sugar for Your Temple
        </Link>
        <p className="mt-3 text-sm text-[#6B5E4F]">Requests are reviewed individually; donations are not guaranteed.</p>
      </div>
    </div>
  );
}
