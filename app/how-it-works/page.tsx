import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";

export const metadata = { title: "How It Works", description: "How temple donation requests are submitted, reviewed, and fulfilled." };

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>How it works</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">From request to delivery.</h1>
      <ol className="mt-8 space-y-4">
        {[
          { t: "Submit your temple's request.", d: "An authorized temple representative completes the Request Sugar form with temple details, contact information, and needs. You will receive a reference number once the submission is saved." },
          { t: "Our team reviews the details and may contact you.", d: "Each request is reviewed individually. Review may include clarifying questions about quantity, timing, delivery, and product suitability." },
          { t: "If approved and resources allow, we coordinate delivery.", d: "Approved requests move to coordination: confirming the product, quantity, and delivery arrangements directly with the temple. Approval does not mean the sugar has been ordered, and ordering does not mean it has been delivered." },
        ].map((s, i) => (
          <li key={s.t}>
            <Card>
              <p className="flex h-10 w-10 items-center justify-center rounded-full bg-terracotta-deeper font-heading font-bold text-white" aria-hidden="true">{i + 1}</p>
              <h2 className="mt-3 text-xl font-bold">{s.t}</h2>
              <p className="mt-2 leading-relaxed text-[#4A4238]">{s.d}</p>
            </Card>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-2xl border border-[#D8A679] bg-[#FFF8EF] p-5" role="note">
        <strong>A submitted request is not a confirmed delivery.</strong> Please wait for written
        approval and delivery arrangements. Temples should not rely on a donation before approval
        and coordination.
      </div>
      <div className="mt-8">
        <Link href="/request-sugar" className="inline-block rounded-full bg-terracotta-deeper px-8 py-3.5 font-semibold text-white hover:bg-[#7E3B1E]">Request a Sugar Donation</Link>
      </div>
    </div>
  );
}
