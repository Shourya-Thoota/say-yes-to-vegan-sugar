import Link from "next/link";
import { Accordion } from "@/components/accordion";
import { Card, Eyebrow } from "@/components/ui";
import { SugarBowlIllustration } from "@/components/brand-mark";

export const metadata = {
  title: "Say Yes to Vegan Sugar — A thoughtful choice for every offering",
  description:
    "Help your temple make informed choices about vegan sugar for prasadam, offerings, and community meals.",
};

const FAQ_PREVIEW = [
  {
    q: "What does vegan sugar mean for this initiative?",
    a: "For this initiative, we seek sugar documented as processed without animal-derived processing aids. Sugar-processing methods can vary by manufacturer and product, so we encourage checking product-specific labeling and manufacturer information.",
  },
  {
    q: "Who can request sugar?",
    a: "Authorized representatives of Hindu temples in the United States may submit a request. Our initial donation program supports selected temples, and each request is reviewed individually.",
  },
  {
    q: "Are donations guaranteed?",
    a: "No. A submitted request is not a confirmed delivery. Approval and delivery depend on review, available resources, and confirmed delivery arrangements.",
  },
  {
    q: "How can I help?",
    a: "You can offer suitable sugar, help coordinate deliveries, introduce the initiative to your temple, or volunteer. Use the Support page to tell us how you would like to help.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 md:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Eyebrow>A community initiative for Hindu temples</Eyebrow>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] sm:text-5xl">
              A thoughtful choice for every offering.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A4238]">
              Help your temple make informed choices about vegan sugar for prasadam, offerings,
              and community meals. Learn what to check—or request a sugar donation for your temple.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request-sugar"
                className="rounded-full bg-terracotta-deeper px-7 py-3.5 text-center text-base font-semibold text-white shadow-sm hover:bg-[#7E3B1E]"
              >
                Request a Sugar Donation
              </Link>
              <Link
                href="/choosing-sugar"
                className="rounded-full border border-terracotta-deeper bg-white px-7 py-3.5 text-center text-base font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
              >
                Learn What to Look For
              </Link>
            </div>
            <p className="mt-4 text-sm text-[#6B5E4F]">
              Supporting selected temples, subject to availability and delivery arrangements.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <Card className="w-full max-w-md">
              <SugarBowlIllustration />
              <p className="mt-2 text-center text-sm text-[#6B5E4F]">
                Sugar-processing methods can vary by manufacturer and product. This initiative
                encourages temples to check product-specific labeling and manufacturer information
                when choosing sugar.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-y border-[#E5DCCB] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <Eyebrow>Our approach</Eyebrow>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Small choices. Thoughtful service.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[#4A4238]">
            Our goal is simple: help temple communities make informed sugar choices and connect
            eligible temples with donated sugar when resources allow. We approach this work with
            respect for each temple&apos;s traditions, purchasing decisions, and existing practices.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <Card>
              <div aria-hidden="true" className="text-3xl text-terracotta-deeper">◯</div>
              <h3 className="mt-3 text-xl font-bold">Understand the concern</h3>
              <p className="mt-2 leading-relaxed text-[#4A4238]">Learn why some communities ask how sugar is processed.</p>
              <Link href="/choosing-sugar" className="mt-3 inline-block font-semibold text-terracotta-deeper underline underline-offset-4">Read the guide</Link>
            </Card>
            <Card>
              <div aria-hidden="true" className="text-3xl text-terracotta-deeper">▤</div>
              <h3 className="mt-3 text-xl font-bold">Check the specific product</h3>
              <p className="mt-2 leading-relaxed text-[#4A4238]">Look for clear labeling and reliable manufacturer information.</p>
              <Link href="/choosing-sugar" className="mt-3 inline-block font-semibold text-terracotta-deeper underline underline-offset-4">See the checklist</Link>
            </Card>
            <Card>
              <div aria-hidden="true" className="text-3xl text-terracotta-deeper">♡</div>
              <h3 className="mt-3 text-xl font-bold">Request community support</h3>
              <p className="mt-2 leading-relaxed text-[#4A4238]">Tell us what your temple needs so we can review your request.</p>
              <Link href="/request-sugar" className="mt-3 inline-block font-semibold text-terracotta-deeper underline underline-offset-4">Start a request</Link>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Three careful steps</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { n: "1", t: "Submit your temple's request.", d: "An authorized temple representative shares temple details, contact information, and needs." },
            { n: "2", t: "Our team reviews the details and may contact you.", d: "Each request is reviewed individually. We may ask for clarification before any decision." },
            { n: "3", t: "If approved and resources allow, we coordinate delivery.", d: "We coordinate the product and delivery directly with your temple after written approval." },
          ].map((s) => (
            <li key={s.n}>
              <Card className="h-full">
                <p className="flex h-10 w-10 items-center justify-center rounded-full bg-terracotta-deeper font-heading text-lg font-bold text-white" aria-hidden="true">{s.n}</p>
                <h3 className="mt-4 text-xl font-bold">{s.t}</h3>
                <p className="mt-2 leading-relaxed text-[#4A4238]">{s.d}</p>
              </Card>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl border border-[#D8A679] bg-[#FFF8EF] p-5 text-[15px] leading-relaxed" role="note">
          <strong>A submitted request is not a confirmed delivery.</strong> Please wait for written approval and delivery arrangements.
        </div>
      </section>

      {/* Education preview */}
      <section className="border-y border-[#E5DCCB] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <Eyebrow>Choosing sugar</Eyebrow>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Know what to look for.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[#4A4238]">
            For this initiative, we seek sugar documented as processed without animal-derived
            processing aids. Because methods vary by manufacturer and product, always check the
            specific package and confirm with the manufacturer when information is unclear.
          </p>
          <Link href="/choosing-sugar" className="mt-5 inline-block rounded-full bg-charcoal px-6 py-3 font-semibold text-white hover:bg-black">
            Open the Choosing-Sugar Guide
          </Link>
        </div>
      </section>

      {/* Invitation + support */}
      <section className="mx-auto max-w-6xl grid gap-5 px-4 py-14 sm:px-6 md:grid-cols-2">
        <Card>
          <Eyebrow>Temple invitation</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">An invitation to temple communities.</h2>
          <p className="mt-3 leading-relaxed text-[#4A4238]">
            We welcome inquiries from Hindu temples across the United States. Our initial donation
            program supports selected temples, and each request is reviewed individually.
          </p>
          <Link href="/request-sugar" className="mt-5 inline-block rounded-full bg-terracotta-deeper px-6 py-3 font-semibold text-white hover:bg-[#7E3B1E]">
            Request a Sugar Donation
          </Link>
        </Card>
        <Card>
          <Eyebrow>Community support</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Help make thoughtful giving possible.</h2>
          <p className="mt-3 leading-relaxed text-[#4A4238]">
            Interested in donating suitable sugar, helping coordinate deliveries, or introducing
            the initiative to your temple? Tell us how you would like to help.
          </p>
          <Link href="/support" className="mt-5 inline-block rounded-full border border-terracotta-deeper px-6 py-3 font-semibold text-terracotta-deeper hover:bg-terracotta-soft">
            Offer Your Support
          </Link>
        </Card>
      </section>

      {/* FAQ preview */}
      <section className="mx-auto max-w-4xl px-4 pb-14 sm:px-6">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-2 text-3xl font-bold">Common questions</h2>
        <div className="mt-6">
          <Accordion items={FAQ_PREVIEW} />
        </div>
        <Link href="/faq" className="mt-5 inline-block font-semibold text-terracotta-deeper underline underline-offset-4">
          Read all questions and answers
        </Link>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[#E5DCCB] bg-charcoal text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Does your temple need sugar?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#EDE6D8]">
            Share your temple&apos;s needs. We&apos;ll review your request and contact you about possible next steps.
          </p>
          <Link href="/request-sugar" className="mt-7 inline-block rounded-full bg-terracotta px-8 py-3.5 text-base font-bold text-charcoal hover:bg-[#F09A6E]">
            Request a Sugar Donation
          </Link>
        </div>
      </section>
    </div>
  );
}
