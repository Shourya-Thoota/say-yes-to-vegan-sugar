import Link from "next/link";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "How It Works", description: "How Temple Initiative awareness, verification, sharing, and donation requests work." };

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>How it works</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Learn, check, share.</h1>
      <ol className="mt-8 space-y-0 divide-y divide-[#E5DCCB] border-y border-[#E5DCCB]">
        {[
          { t: "Learn the concern.", d: "Read why some cane-sugar refining uses bone char as a filtering aid, and why methods vary by manufacturer and product." },
          { t: "Check the specific product.", d: "Identify the exact manufacturer, product, and package; review product-specific documentation; and ask the manufacturer when unclear." },
          { t: "Share the message.", d: "Send this page to temple volunteers, kitchen teams, family, and friends using the homepage sharing tools." },
          { t: "Request support only if needed.", d: "Authorized temple representatives may submit a donation request for consideration. Each request is reviewed individually; donations and delivery are not guaranteed." },
        ].map((s, i) => (
          <li key={s.t} className="grid grid-cols-[3rem_1fr] gap-4 py-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal font-heading font-bold text-white" aria-hidden="true">{i + 1}</span>
            <div>
              <h2 className="text-xl font-bold">{s.t}</h2>
              <p className="mt-2 leading-relaxed text-[#4A4238]">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-2xl border border-[#D8A679] bg-[#FFF8EF] p-5" role="note">
        <strong>A submitted donation request is not a confirmed delivery.</strong> Please wait for written
        approval and delivery arrangements. Temples should not rely on a donation before approval
        and coordination.
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/choosing-sugar" className="inline-block rounded-full bg-charcoal px-8 py-3.5 text-center font-semibold text-white hover:bg-black">Open the Choosing-Sugar Guide</Link>
        <Link href="/request-sugar" className="inline-block rounded-full border border-terracotta-deeper px-8 py-3.5 text-center font-semibold text-terracotta-deeper hover:bg-terracotta-soft">Request Sugar for Your Temple</Link>
      </div>
    </div>
  );
}
