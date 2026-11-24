import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { isStripeSponsorshipEnabled } from "@/lib/config";
import { SponsorForm } from "./sponsor-form";
import { getPublicFulfillmentEntries, getPublicFulfillmentTotals } from "@/lib/fulfillment-ledger";

export const metadata = {
  title: "Sponsor Vegan Sugar",
  description:
    "Sponsor vegan sugar for participating Hindu temples. Transparent fulfillment ledger shows every public delivery.",
};

function formatDate(d: Date): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  } catch {
    return "";
  }
}

export default async function SponsorPage({
  searchParams,
}: {
  searchParams?: Promise<{ cancelled?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const cancelled = sp.cancelled === "1";
  const enabled = isStripeSponsorshipEnabled();

  let entries: Awaited<ReturnType<typeof getPublicFulfillmentEntries>> = [];
  let totals = { totalPounds: 0, totalDeliveries: 0 };
  let ledgerUnavailable = false;
  try {
    entries = await getPublicFulfillmentEntries(100);
    totals = await getPublicFulfillmentTotals();
  } catch {
    ledgerUnavailable = true;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>Community sponsorship</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Sponsor vegan sugar.</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#4A4238]">
        Your sponsorship helps Temple Initiative purchase suitable vegan sugar and arrange
        deliveries for participating Hindu temples.
      </p>

      {cancelled && (
        <p role="status" className="mt-6 break-words rounded-2xl border border-[#D8A679] bg-[#FFF8EF] p-5 text-[15px]">
          Checkout was closed before completion. If you completed payment, confirmation may still
          be processing — check email or <Link href="/contact" className="underline">contact us</Link> before
          trying again. You can choose a tier below whenever you are ready.
        </p>
      )}

      <section aria-labelledby="terms-heading" className="mt-8 rounded-2xl bg-cream p-5 text-[15px] leading-relaxed text-[#4A4238] sm:p-6">
        <h2 id="terms-heading" className="font-heading text-xl font-bold text-charcoal">
          Important terms — please read
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Temple Initiative is operated by <strong>Pansophy LLC</strong> under New York law.
          </li>
          <li>
            Contributions support vegan sugar purchases and deliveries for participating temples
            and are <strong>not tax-deductible charitable donations</strong>.
          </li>
          <li>
            All sponsorships are <strong>final and non-refundable</strong> except for billing errors.
            If you notice a billing error, please <Link href="/contact" className="underline">contact us</Link> and we will review it promptly.
          </li>
          <li>
            Sponsorships support the program generally and are <strong>not promised to map to any
            specific delivery</strong>. Public deliveries are recorded in the fulfillment transparency
            ledger below.
          </li>
          <li>
            Tier amounts are <strong>provisional launch amounts</strong> subject to operator review,
            and pound figures are <strong>approximate estimates</strong>, not guaranteed quantities.
          </li>
        </ul>
      </section>

      {enabled ? (
        <SponsorForm />
      ) : (
        <section
          aria-labelledby="coming-soon-heading"
          className="mt-6 rounded-2xl border border-[#E5DCCB] bg-white p-6 text-center sm:p-8"
        >
          <h2 id="coming-soon-heading" className="font-heading text-2xl font-bold">
            Online sponsorship is opening soon.
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[#4A4238]">
            Secure online checkout is not turned on yet. You can still support the work today by
            offering suitable sugar or coordination help — or browse the temples already taking part.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/support"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-terracotta-deeper px-6 py-3 font-semibold text-white hover:bg-[#7E3B1E]"
            >
              Offer Support
            </Link>
            <Link
              href="/temples"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-terracotta-deeper px-6 py-3 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
            >
              Browse Temples
            </Link>
          </div>
        </section>
      )}

      <section aria-labelledby="ledger-heading" className="mt-10">
        <h2 id="ledger-heading" className="font-heading text-3xl font-bold">
          Fulfillment transparency ledger
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-[#4A4238]">
          Every public delivery we record appears here — what was delivered, where it went, and
          when. Private contact details are never shown.
        </p>

        {ledgerUnavailable ? (
          <div role="status" className="mt-5 rounded-2xl border border-[#E5DCCB] bg-white p-8 text-center">
            <p className="font-heading text-xl font-bold">The ledger is temporarily unavailable.</p>
            <p className="mx-auto mt-2 max-w-xl text-[#4A4238]">
              We could not load deliveries just now. Please try again in a little while.
            </p>
          </div>
        ) : totals.totalDeliveries === 0 ? (
          <div className="mt-5 rounded-2xl border border-[#E5DCCB] bg-white p-8 text-center">
            <p className="font-heading text-xl font-bold">No public deliveries recorded yet.</p>
            <p className="mx-auto mt-2 max-w-xl leading-relaxed text-[#4A4238]">
              When Temple Initiative completes a delivery and marks it public, it will appear here
              with the product, weight, recipient community, and date.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2" role="status" aria-live="polite">
              <div className="rounded-2xl border border-[#E5DCCB] bg-white p-5 text-center">
                <p className="font-heading text-4xl font-bold">{totals.totalPounds.toLocaleString()} lb</p>
                <p className="mt-1 text-[#4A4238]">vegan sugar delivered publicly</p>
              </div>
              <div className="rounded-2xl border border-[#E5DCCB] bg-white p-5 text-center">
                <p className="font-heading text-4xl font-bold">{totals.totalDeliveries.toLocaleString()}</p>
                <p className="mt-1 text-[#4A4238]">public {totals.totalDeliveries === 1 ? "delivery" : "deliveries"} recorded</p>
              </div>
            </div>
            <ul className="mt-4 space-y-4">
              {entries.map((e) => (
                <li key={e.publicRef} className="rounded-2xl border border-[#E5DCCB] bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-heading text-xl font-bold">{e.recipientLabel}</h3>
                      <p className="mt-1 break-words text-[#4A4238]">
                        {[e.city, e.state].filter(Boolean).join(", ") || "Location shared with temple"}
                      </p>
                    </div>
                    <p className="shrink-0 rounded-full bg-cream px-4 py-1.5 font-heading text-lg font-bold">
                      {e.poundsDelivered.toLocaleString()} lb (est.)
                    </p>
                  </div>
                  <p className="mt-3 break-words leading-relaxed text-[#4A4238]">{e.sugarProductLabel}</p>
                  <p className="mt-2 break-words text-sm text-[#6B5E4F]">
                    Delivered {formatDate(e.deliveredAt)} · Ref {e.publicRef}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
