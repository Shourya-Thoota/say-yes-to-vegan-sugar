import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { donationRequests, fulfillmentLedger, sponsorshipOrders } from "@/lib/schema";
import { createFulfillmentEntry, setFulfillmentVisibility } from "@/lib/admin-actions";
import { SPONSORSHIP_TIERS, formatCentsUsd } from "@/lib/sponsorship";
import { newIdempotencyKey } from "@/lib/reference";

export const metadata = { title: "Fulfillment Ledger", robots: { index: false, follow: false } };

export default async function AdminFulfillmentPage() {
  const admin = await requireAdmin();
  if (!admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-heading text-3xl font-bold">Access denied</h1>
        <p className="mt-3">Administrator sign-in is required.</p>
        <Link href="/admin/signin" className="mt-5 inline-block rounded-full bg-charcoal px-6 py-3 font-semibold text-white">
          Sign in
        </Link>
      </div>
    );
  }
  const db = getDb();
  if (!db) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-heading text-3xl font-bold">Database unavailable</h1>
        <p className="mt-3">DATABASE_URL is not configured.</p>
      </div>
    );
  }

  const orders = await db.select().from(sponsorshipOrders).orderBy(desc(sponsorshipOrders.createdAt)).limit(50);
  const entries = await db.select().from(fulfillmentLedger).orderBy(desc(fulfillmentLedger.deliveredAt)).limit(100);
  const requests = await db
    .select({
      id: donationRequests.id,
      templeName: donationRequests.templeName,
      city: donationRequests.city,
      state: donationRequests.state,
      publicRef: donationRequests.publicRef,
      publicListingConsent: donationRequests.publicListingConsent,
      publicListingStatus: donationRequests.publicListingStatus,
    })
    .from(donationRequests)
    .orderBy(desc(donationRequests.createdAt))
    .limit(200);
  const submissionKey = newIdempotencyKey();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 font-heading text-3xl font-bold">Sponsorship &amp; fulfillment</h1>
      <p className="mt-1 text-[#4A4238]">
        Signed in as {admin.email} · Private emails and internal notes are never shown publicly.
      </p>

      <section aria-labelledby="orders-heading" className="mt-8">
        <h2 id="orders-heading" className="font-heading text-2xl font-bold">
          Recent sponsorship orders ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-[#E5DCCB] bg-white p-5 text-[#4A4238]">
            No sponsorship orders yet. Orders appear here after a Stripe checkout session is created.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E5DCCB] bg-white">
            <table className="w-full min-w-[760px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-[#E5DCCB] text-sm text-[#6B5E4F]">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const tier = (SPONSORSHIP_TIERS as Record<string, { label: string }>)[o.tierCode];
                  return (
                    <tr key={o.id} className="border-b border-[#F0E9DA] last:border-0">
                      <td className="px-4 py-3 font-mono text-sm">{o.publicRef}</td>
                      <td className="px-4 py-3">{tier?.label ?? o.tierCode}</td>
                      <td className="px-4 py-3">{formatCentsUsd(o.amountCents)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-cream px-3 py-1 text-sm font-semibold">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6B5E4F]">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="record-heading" className="mt-10 rounded-2xl border border-[#E5DCCB] bg-white p-5 sm:p-6">
        <h2 id="record-heading" className="font-heading text-2xl font-bold">
          Record a delivery
        </h2>
        <p className="mt-1 text-sm text-[#6B5E4F]">
          Temple names are resolved server-side from the linked request and shown publicly only while
          that temple&apos;s listing consent is on and its status is published. Otherwise the ledger
          shows an anonymized &ldquo;Participating Temple (STATE)&rdquo; with no city. Unlinked
          deliveries are always anonymized. Only weight, product, and date ever appear publicly — and
          only when &ldquo;publicly visible&rdquo; is on. The checkbox defaults to off.
        </p>
        <form action={createFulfillmentEntry} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="idempotencyKey" value={submissionKey} />
          <div className="sm:col-span-2">
            <label htmlFor="f-request" className="block text-sm font-semibold">
              Linked temple request (required for named listing) *
            </label>
            <select id="f-request" name="donationRequestId" defaultValue="" className="mt-1 w-full rounded-xl border border-[#D8CCB8] bg-white px-4 py-2.5">
              <option value="">No linked request — record anonymously</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.templeName} — {r.city}, {r.state} ({r.publicRef}
                  {r.publicListingConsent && r.publicListingStatus === "published" ? ", listed" : ", private"})
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-[#6B5E4F]">
              Choose a request to link this delivery. Leave empty for an anonymized entry.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="f-order" className="block text-sm font-semibold">
              Linked sponsorship order (optional)
            </label>
            <select id="f-order" name="sponsorshipOrderId" defaultValue="" className="mt-1 w-full rounded-xl border border-[#D8CCB8] bg-white px-4 py-2.5">
              <option value="">No linked order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.publicRef} — {o.tierCode} — {o.status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-state" className="block text-sm font-semibold">
              State (2 letters, for anonymized label)
            </label>
            <input id="f-state" name="state" maxLength={2} placeholder="TX" className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5" />
          </div>
          <div>
            <label htmlFor="f-pounds" className="block text-sm font-semibold">
              Pounds delivered (estimate record) *
            </label>
            <input id="f-pounds" name="poundsDelivered" required inputMode="numeric" placeholder="50" className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5" />
          </div>
          <div>
            <label htmlFor="f-date" className="block text-sm font-semibold">
              Delivered on (YYYY-MM-DD) *
            </label>
            <input id="f-date" name="deliveredAt" required placeholder="2026-01-15" className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="f-product" className="block text-sm font-semibold">
              Sugar product label *
            </label>
            <input
              id="f-product"
              name="sugarProductLabel"
              required
              maxLength={300}
              placeholder="e.g. Organic cane sugar, 50 lb"
              className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="f-notes" className="block text-sm font-semibold">
              Internal notes (admins only, never public)
            </label>
            <textarea id="f-notes" name="internalNotes" rows={2} maxLength={2000} className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5" />
          </div>
          <div className="flex items-center gap-3">
            <input id="f-visible" name="publicVisible" type="checkbox" value="true" className="h-5 w-5 accent-[#7E3B1E]" />
            <label htmlFor="f-visible" className="break-words text-[15px]">
              Publicly visible in the transparency ledger (off by default)
            </label>
          </div>
          <div>
            <button type="submit" className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-charcoal px-6 py-2.5 font-semibold text-white hover:bg-black">
              Record delivery
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="entries-heading" className="mt-10">
        <h2 id="entries-heading" className="font-heading text-2xl font-bold">
          Ledger entries ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-[#E5DCCB] bg-white p-5 text-[#4A4238]">
            No deliveries recorded yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {entries.map((e) => (
              <li key={e.id} className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-bold">
                      {e.recipientLabel}{" "}
                      <span className="font-mono text-sm font-normal text-[#6B5E4F]">{e.publicRef}</span>
                    </p>
                    <p className="mt-1 break-words text-[15px] text-[#4A4238]">
                      {[e.city, e.state].filter(Boolean).join(", ") || "—"} · {e.poundsDelivered} lb ·{" "}
                      {e.sugarProductLabel} · {new Date(e.deliveredAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-sm text-[#6B5E4F]">
                      Recorded by {e.recordedBy} · {e.publicVisible ? "Public" : "Hidden"}
                      {e.internalNotes ? ` · Note: ${e.internalNotes.slice(0, 120)}` : ""}
                    </p>
                  </div>
                  <form action={setFulfillmentVisibility} className="flex items-center gap-2">
                    <input type="hidden" name="entryId" value={e.id} />
                    <input type="hidden" name="publicVisible" value={e.publicVisible ? "false" : "true"} />
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-charcoal px-5 py-2 text-sm font-semibold hover:bg-cream"
                    >
                      {e.publicVisible ? "Hide" : "Publish"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
