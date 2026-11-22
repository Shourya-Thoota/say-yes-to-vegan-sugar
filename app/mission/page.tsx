import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";

export const metadata = { title: "Our Mission", description: "Why Say Yes to Vegan Sugar exists and how it works with temples." };

export default function MissionPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>Our mission</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Small choices. Thoughtful service.</h1>
      <p className="mt-5 text-lg leading-relaxed text-[#4A4238]">
        Say Yes to Vegan Sugar is an independent community initiative. Our goal is simple: help
        temple communities make informed sugar choices and connect eligible temples with donated
        sugar when resources allow. We approach this work with respect for each temple&apos;s
        traditions, purchasing decisions, and existing practices.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold">What we do</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-[#4A4238]">
            <li>Share careful, product-specific sugar-selection guidance.</li>
            <li>Accept donation requests from authorized temple representatives.</li>
            <li>Review each request individually.</li>
            <li>Coordinate approved donations when resources allow.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">What we do not do</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-[#4A4238]">
            <li>Guarantee donations or nationwide delivery.</li>
            <li>Certify products or publish approved-product lists.</li>
            <li>Claim affiliation with any temple without confirmation.</li>
            <li>Operate an online store or accept payments.</li>
          </ul>
        </Card>
      </div>
      <p className="mt-8 leading-relaxed text-[#4A4238]">
        Sugar-processing methods can vary by manufacturer and product. This initiative encourages
        temples to check product-specific labeling and manufacturer information when choosing sugar.
        For this initiative, we seek sugar documented as processed without animal-derived processing aids.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/how-it-works" className="rounded-full bg-charcoal px-7 py-3 text-center font-semibold text-white hover:bg-black">See How It Works</Link>
        <Link href="/request-sugar" className="rounded-full bg-terracotta-deeper px-7 py-3 text-center font-semibold text-white hover:bg-[#7E3B1E]">Request a Sugar Donation</Link>
      </div>
    </div>
  );
}
