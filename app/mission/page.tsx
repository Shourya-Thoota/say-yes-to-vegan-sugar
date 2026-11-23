import Link from "next/link";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Our Mission", description: "Temple Initiative’s mission: awareness first, product verification, sharing, and secondary donation support." };

export default function MissionPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>Our mission</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Awareness first. Choice with care.</h1>
      <p className="mt-5 text-lg leading-relaxed text-[#4A4238]">
        Temple Initiative’s current campaign, Say Yes to Vegan Sugar, helps temple communities make
        informed choices about vegan sugar and share that awareness with others. Our main goal is a
        clear public-service message: check how the specific sugar product is processed, choose with
        care, and pass the message on.
      </p>
      <div className="mt-8 space-y-6">
        <section className="border-t border-[#D8CCB8] pt-6">
          <h2 className="font-heading text-xl font-bold">1. Awareness</h2>
          <p className="mt-2 leading-relaxed text-[#4A4238]">Explain, in plain language, that some cane-sugar refining uses bone char as a filtering aid—and that methods vary by manufacturer and product.</p>
        </section>
        <section className="border-t border-[#D8CCB8] pt-6">
          <h2 className="font-heading text-xl font-bold">2. Product verification</h2>
          <p className="mt-2 leading-relaxed text-[#4A4238]">Help volunteers check the exact product: manufacturer, product name, package labeling, and manufacturer information. Keep responses on file and recheck when things change.</p>
        </section>
        <section className="border-t border-[#D8CCB8] pt-6">
          <h2 className="font-heading text-xl font-bold">3. Sharing</h2>
          <p className="mt-2 leading-relaxed text-[#4A4238]">Encourage one conversation at a time with kitchen teams, volunteers, family, and friends. Sharing tools are built into the homepage.</p>
        </section>
        <section className="border-t border-[#D8CCB8] pt-6">
          <h2 className="font-heading text-xl font-bold">4. Secondary donation support</h2>
          <p className="mt-2 leading-relaxed text-[#4A4238]">When resources allow, we also help selected temples with sugar donations. Authorized temple representatives may submit a request for consideration. Requests are reviewed individually; donations and delivery are not guaranteed.</p>
        </section>
      </div>
      <p className="mt-8 leading-relaxed text-[#4A4238]">
        Sugar-processing methods can vary by manufacturer and product. This initiative encourages
        temples to check product-specific labeling and manufacturer information when choosing sugar.
        For this campaign, we seek sugar documented as processed without animal-derived processing aids.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/how-it-works" className="rounded-full bg-charcoal px-7 py-3 text-center font-semibold text-white hover:bg-black">See How It Works</Link>
        <Link href="/#share" className="rounded-full bg-terracotta-deeper px-7 py-3 text-center font-semibold text-white hover:bg-[#7E3B1E]">Share the Message</Link>
      </div>
    </div>
  );
}
