import Link from "next/link";
import { Eyebrow } from "@/components/ui";

// Never index a per-checkout return page, and never assert payment from a
// user-supplied reference.
export const metadata = {
  title: "Sponsorship Checkout Returned",
  robots: { index: false, follow: false },
};

export default async function SponsorSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ ref?: string; cancelled?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const ref = (sp.ref ?? "").trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Thank you</Eyebrow>
      <h1 className="mt-2 break-words text-4xl font-bold sm:text-5xl">Checkout returned.</h1>
      <p className="mt-4 break-words text-lg leading-relaxed text-[#4A4238]">
        Checkout has returned to our site — payment confirmation may still be processing. If your
        payment succeeded, your sponsorship supports Temple Initiative&apos;s vegan-sugar work
        generally; it is not promised to map to any specific delivery. When sponsored sugar is
        delivered and recorded publicly, it appears in the fulfillment transparency ledger.
      </p>
      {ref && (
        <p className="mt-4 break-words rounded-2xl border border-[#E5DCCB] bg-white p-5 text-[15px]">
          Sponsorship reference: <span className="font-mono font-bold">{ref}</span>
          <span className="mt-1 block text-sm text-[#6B5E4F]">
            Keep this reference if you contact us about your sponsorship. This reference alone does
            not confirm that payment was received.
          </span>
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/sponsor"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-terracotta-deeper px-6 py-3 font-semibold text-white hover:bg-[#7E3B1E]"
        >
          View Transparency Ledger
        </Link>
        <Link
          href="/temples"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-terracotta-deeper px-6 py-3 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
        >
          Browse Temples
        </Link>
      </div>
      <p className="mt-6 break-words text-sm leading-relaxed text-[#6B5E4F]">
        Contributions support Temple Initiative&apos;s vegan-sugar work (operated by Pansophy LLC)
        and are not tax-deductible charitable donations. Sponsorships are non-refundable except
        for billing errors — <Link href="/contact" className="underline">contact us</Link> if
        something looks wrong. Sponsorship tiers show provisional launch amounts (subject to
        operator review) and pound figures are estimates, not guaranteed quantities.
      </p>
    </div>
  );
}
