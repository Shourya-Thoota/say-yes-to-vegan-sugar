import Link from "next/link";
import { Accordion } from "@/components/accordion";
import { Eyebrow } from "@/components/ui";
import { TempleHeroIllustration } from "@/components/brand-mark";
import { ShareSection } from "@/components/share-section";
import { VideoEmbed } from "@/components/video-embed";

export const metadata = {
  title: "Temple Initiative | Say Yes to Vegan Sugar",
  description:
    "Temple Initiative’s Say Yes to Vegan Sugar campaign helps temple communities check sugar-processing information, make informed choices, and share awareness.",
};

const FAQ_PREVIEW = [
  {
    q: "Why does sugar processing matter to some vegetarian and vegan communities?",
    a: "Some cane-sugar refining uses bone char, a filtering aid made from animal bones, to remove color. Communities that avoid animal-derived processing aids may wish to choose sugar documented as processed without them. Sugar itself does not contain bone char as an ingredient; the concern is about how it was filtered.",
  },
  {
    q: "Is bone char an ingredient in sugar?",
    a: "No. Bone char is a processing or filtering aid used in some refining, not an ingredient left in finished sugar. That distinction matters: the question is whether animal-derived aids were used during processing, not whether sugar contains them.",
  },
  {
    q: "Does every sugar product use the same processing method?",
    a: "No. Sugar-processing methods can vary by manufacturer and product. If your temple avoids animal-derived processing aids, check the specific product and package rather than assuming every product from a brand is processed the same way.",
  },
  {
    q: "How can I check a specific product?",
    a: "Identify the exact manufacturer, product name, and package; look for product-specific vegan labeling or manufacturer information; and contact the manufacturer when the answer is unclear. Keep the response for your purchasing records.",
  },
  {
    q: "Can I rely on a retailer or brand name alone?",
    a: "No. Processing can differ between products, facilities, and time periods. Check the specific product and package rather than assuming every product from a brand or retailer is processed the same way.",
  },
  {
    q: "How can I share this message with my temple?",
    a: "Start one conversation: use the sharing tools below to send this page to temple volunteers, kitchen teams, family, and friends. Nothing is sent automatically; you choose where to share.",
  },
  {
    q: "Can a temple request donated sugar?",
    a: "Authorized temple representatives may submit a request for consideration through the form below. Requests are reviewed individually. Donations and delivery are not guaranteed.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* A. Welcome hero */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 md:pt-16">
        <div className="grid items-start gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div className="md:pt-4">
            <p className="inline-flex items-center rounded-full border border-[#D8CCB8] bg-white px-4 py-1.5 text-[13px] font-semibold text-[#6B5E4F]">
              A public-service message from Temple Initiative
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-[1.04] sm:text-6xl">
              Say yes to vegan sugar.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#4A4238]">
              A warm welcome to temple cooks, volunteers, and families: a quick package check helps
              your kitchen choose sugar with confidence — and share what you learn with others.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/choosing-sugar"
                className="min-h-[44px] rounded-xl bg-terracotta-deeper px-7 py-3.5 text-center text-base font-semibold text-white shadow-sm hover:bg-[#7E3B1E]"
              >
                Learn how to check sugar
              </Link>
              <Link
                href="/#share"
                className="min-h-[44px] rounded-xl border border-terracotta-deeper bg-white px-7 py-3.5 text-center text-base font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
              >
                Share this message
              </Link>
            </div>
            <p className="mt-5 text-[15px] text-[#6B5E4F]">
              <Link href="/request-sugar" className="font-semibold text-terracotta-deeper underline underline-offset-4">
                Need sugar for your temple? Request support.
              </Link>
            </p>
          </div>
          <div className="md:justify-self-end md:pt-2">
            <TempleHeroIllustration className="w-full max-w-lg" />
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#6B5E4F]">
              Illustrated package check. Labels shown are generic examples, not real manufacturer
              evidence.
            </p>
          </div>
        </div>
        <hr className="mt-12 border-t border-[#D8CCB8]" aria-hidden="true" />
        <p className="mt-4 text-sm text-[#6B5E4F]">
          Temple Initiative · Current campaign: Say Yes to Vegan Sugar
        </p>
      </section>

      {/* B. What the concern is */}
      <section id="why-check" aria-labelledby="why-check-heading" className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Eyebrow>Why check the sugar?</Eyebrow>
            <h2 id="why-check-heading" className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
              Some white sugar is filtered with an animal-derived aid.
            </h2>
            <p className="mt-4 leading-relaxed text-[#4A4238]">
              If your community follows vegetarian or vegan purchasing standards, sugar deserves the
              same thoughtful review you already give ghee, milk, and other ingredients.
            </p>
          </div>
          <div className="max-w-2xl text-[17px] leading-relaxed text-[#3E372E]">
            <p>
              Some cane-sugar refining uses{" "}
              <strong>bone char</strong>—a granular filtering material made from animal
              bones—to remove color during processing. It acts as a processing aid; it is not an
              ingredient left in the finished sugar.{" "}
              <a className="source-link" href="https://www.epa.gov/sites/default/files/2020-10/documents/c9s10-1a.pdf" target="_blank" rel="noopener noreferrer">
                Source: EPA, Sugarcane Processing [PDF]
              </a>
            </p>
            <p className="mt-4">
              Use varies by refinery and product. For example, Domino Foods states that it uses
              natural charcoal (bone char) for decolorization at specific refineries,{" "}
              <a className="source-link" href="https://asr-group.com/sites/default/files/2026-01/BSE-TSE%20Statement%20-%20DFI%20Web.pdf" target="_blank" rel="noopener noreferrer">
                Source: Domino Foods statement [PDF]
              </a>{" "}
              while its turbinado sugar “is made without using natural charcoal as a filter and is
              vegan.”{" "}
              <a className="source-link" href="https://www.dominosugar.com/baking-tips-how-tos/turbinado-faq" target="_blank" rel="noopener noreferrer">
                Source: Domino Turbinado FAQs
              </a>
            </p>
            <p className="mt-4">
              Other producers document a different path: Wholesome Sweeteners states that all of its
              sugar products are vegan and that it does not process any of them through bone or
              animal by-products.{" "}
              <a className="source-link" href="https://wholesomesweet.com/pages/faq" target="_blank" rel="noopener noreferrer">
                Source: Wholesome FAQs
              </a>{" "}
              Certification programs such as Vegan Action do not allow sugar refined through bone
              char to carry the Certified Vegan Logo and require manufacturer documentation.{" "}
              <a className="source-link" href="https://vegan.org/certification/certification-faqs" target="_blank" rel="noopener noreferrer">
                Source: Vegan Action FAQs
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* C. Thoughtful note for temple kitchens */}
      <section aria-labelledby="thoughtful-check-heading" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <h2 id="thoughtful-check-heading" className="text-3xl font-bold leading-tight sm:text-4xl">
              A thoughtful check for temple kitchens
            </h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-[#4A4238]">
              The filtering method is not visible in the finished crystals and cannot be judged by
              appearance. We do not prescribe religious rules, and we respect that temples interpret
              vegetarian standards differently.
            </p>
          </div>
          <blockquote className="rounded-2xl border border-[#E5DCCB] bg-white p-6 text-[17px] italic leading-relaxed text-[#4A4238]">
            “If your community reviews ingredients with care, include sugar in that review. A quick
            product check helps volunteers make consistent, informed choices.”
          </blockquote>
        </div>
      </section>

      {/* D. Practical steps */}
      <section id="what-to-look" aria-labelledby="what-to-look-heading" className="border-y border-[#E5DCCB] bg-[#EFE7D8]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow>What to look for</Eyebrow>
            <h2 id="what-to-look-heading" className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
              Three things to do before buying.
            </h2>
            <p className="mt-4 leading-relaxed text-[#4A4238]">
              For this campaign, we seek sugar documented as processed without animal-derived
              processing aids.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/choosing-sugar" className="inline-block min-h-[44px] rounded-xl bg-charcoal px-6 py-3 text-center font-semibold text-white hover:bg-black">
                Open the full guide
              </Link>
              <Link href="/poster" className="inline-block min-h-[44px] rounded-xl border border-charcoal bg-white px-6 py-3 text-center font-semibold text-charcoal hover:bg-white/70">
                Print the one-page kitchen guide
              </Link>
            </div>
          </div>
          <ol className="divide-y divide-[#D8CCB8] border-y border-[#D8CCB8]">
            {[
              { t: "Identify the exact product.", d: "Check the manufacturer, product name, and package—not just the retailer." },
              { t: "Look for clear documentation.", d: "Review product-specific vegan labeling or manufacturer information." },
              { t: "Ask when the answer is unclear.", d: "Contact the manufacturer and keep its response for your purchasing records." },
            ].map((s, i) => (
              <li key={s.t} className="grid grid-cols-[3.5rem_1fr] gap-4 py-6">
                <span className="font-heading text-4xl font-bold text-terracotta-deeper" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-heading text-xl font-bold">{s.t}</h3>
                  <p className="mt-1 leading-relaxed text-[#4A4238]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* E. Verified video */}
      <section aria-labelledby="video-heading" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="video-heading" className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          See how sugar is processed.
        </h2>
        <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-[#4A4238]">
          This CBC British Columbia segment provides context on sugar processing. The page below it
          remains the complete guide for your kitchen.
        </p>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h3 className="font-heading text-2xl font-bold">Sugar is sweet but is it vegan?</h3>
            <p className="mt-1 text-[15px] font-semibold text-[#6B5E4F]">CBC British Columbia · YouTube</p>
            <p className="mt-4 leading-relaxed text-[#4A4238]">
              A CBC British Columbia segment about sugar processing that mentions baking
              alternatives. It offers context on the filtering step—not a comprehensive
              guide. The publisher does not endorse Temple Initiative.
            </p>
            <div className="mt-4 rounded-2xl border border-[#E5DCCB] bg-white p-5 text-[15px] leading-relaxed text-[#4A4238]">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#6B5E4F]">Text summary</p>
              <p className="mt-2">
                Bone char can be used to decolorize some cane sugar; it is a processing aid, not an
                ingredient. Methods vary by maker and product, so a responsible check means reading
                the exact package and confirming with the manufacturer. This 2022 segment mentions
                Canadian products, so verify current product-specific information.
              </p>
              <a
                href="https://www.youtube.com/watch?v=tOw5M40uSyk"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block min-h-[44px] font-semibold text-terracotta-deeper underline underline-offset-4"
              >
                Watch on YouTube
              </a>
            </div>
          </div>
          <VideoEmbed
            videoId="tOw5M40uSyk"
            title="Sugar is sweet but is it vegan? by CBC British Columbia"
            watchUrl="https://www.youtube.com/watch?v=tOw5M40uSyk"
          />
        </div>
      </section>

      {/* F. Sharing */}
      <section id="share" aria-labelledby="share-heading" className="border-y border-[#E5DCCB] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="share-heading" className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Share the message with your temple community.
          </h2>
          <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-[#4A4238]">
            A small purchasing check can start with one conversation. Share this page with temple
            volunteers, kitchen teams, family, and friends.
          </p>
          <ShareSection />
        </div>
      </section>

      {/* G. FAQ */}
      <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <h2 id="faq-heading" className="text-3xl font-bold sm:text-4xl">Common questions.</h2>
        <div className="mt-6">
          <Accordion items={FAQ_PREVIEW} />
        </div>
        <Link href="/faq" className="mt-5 inline-block min-h-[44px] font-semibold text-terracotta-deeper underline underline-offset-4">
          Read all questions and answers
        </Link>
      </section>

      {/* H. Secondary donation request */}
      <section aria-labelledby="request-heading" className="border-t border-[#E5DCCB] bg-[#EFE7D8]">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
          <h2 id="request-heading" className="text-3xl font-bold sm:text-4xl">
            Need help sourcing sugar for your temple?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[#4A4238]">
            Our main goal is awareness. When resources allow, we also help selected temples with
            sugar donations. Authorized temple representatives can submit a request for consideration.
          </p>
          <Link href="/request-sugar" className="mt-7 inline-block min-h-[44px] rounded-xl bg-charcoal px-8 py-3.5 text-base font-semibold text-white hover:bg-black">
            Request Sugar for Your Temple
          </Link>
          <p className="mt-4 text-sm text-[#6B5E4F]">
            Requests are reviewed individually. Donations and delivery are not guaranteed.
          </p>
        </div>
      </section>
    </div>
  );
}
