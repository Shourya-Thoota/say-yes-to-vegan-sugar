import Link from "next/link";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Thank You for Your Sponsorship" };

export default async function SponsorSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ ref?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const ref = (sp.ref ?? "").trim().slice(0, 20);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Thank you</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Thank you for your sponsorship.</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#4A4238]">
        Your payment was received. When your sponsored sugar is delivered and recorded publicly,
        it will appear in the fulfillment transparency ledger.
      </p>
      {ref && (
        <p className="mt-4 rounded-2xl border border-[#E5DCCB] bg-white p-5 text-[15px]">
          Sponsorship reference: <span className="font-mono font-bold">{ref}</span>
          <span className="mt-1 block text-sm text-[#6B5E4F]">
            Keep this reference if you contact us about your sponsorship.
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
      <p className="mt-6 text-sm leading-relaxed text-[#6B5E4F]">
        Contributions support Temple Initiative&apos;s vegan-sugar work (operated by Pansophy LLC)
        and are not tax-deductible charitable donations. Sponsorships are non-refundable except
        for billing errors — <Link href="/contact" className="underline">contact us</Link> if
        something looks wrong.
      </p>
    </div>
  );
}
