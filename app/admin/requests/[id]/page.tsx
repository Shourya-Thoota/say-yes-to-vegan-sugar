import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { donationRequests, requestNotes, statusHistory } from "@/lib/schema";
import { addRequestNote, updatePublicListing, updateRequestStatus } from "@/lib/admin-actions";
import { STATUS_LABELS } from "@/lib/csv";
import { PUBLIC_LISTING_SUMMARY_MAX_LENGTH } from "@/lib/schema";

export const metadata = { title: "Request Detail", robots: { index: false, follow: false } };

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) {
    return <div className="mx-auto max-w-md px-4 py-16"><h1 className="font-heading text-3xl font-bold">Access denied</h1><Link href="/admin/signin" className="mt-4 inline-block underline">Sign in</Link></div>;
  }
  const db = getDb();
  if (!db) return <div className="mx-auto max-w-md px-4 py-16">Database unavailable.</div>;

  const rows = await db.select().from(donationRequests).where(eq(donationRequests.id, id)).limit(1);
  if (rows.length === 0) notFound();
  const r = rows[0];
  const notes = await db.select().from(requestNotes).where(eq(requestNotes.requestId, r.id)).orderBy(desc(requestNotes.createdAt));
  const history = await db.select().from(statusHistory).where(eq(statusHistory.requestId, r.id)).orderBy(desc(statusHistory.createdAt));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="underline">← Back to dashboard</Link>
      <h1 className="mt-3 font-heading text-3xl font-bold">{r.templeName} <span className="font-mono text-lg font-normal text-[#6B5E4F]">{r.publicRef}</span></h1>
      <p className="mt-1">Current status: <strong>{STATUS_LABELS[r.status] ?? r.status}</strong></p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
          <h2 className="font-heading text-xl font-bold">Temple</h2>
          <dl className="mt-3 space-y-2 text-[15px]">
            <div><dt className="font-semibold">Address</dt><dd>{r.streetAddress}{r.addressLine2 ? `, ${r.addressLine2}` : ""}, {r.city}, {r.state} {r.zipCode}, {r.country}</dd></div>
            <div><dt className="font-semibold">Website</dt><dd className="break-all">{r.templeWebsite ?? "—"}</dd></div>
            <div><dt className="font-semibold">Quantity</dt><dd>{r.quantityPounds} lb · needed {r.dateNeeded ?? "flexible"}</dd></div>
            <div><dt className="font-semibold">Intended use</dt><dd>{(r.intendedUse as string[]).join(", ")}</dd></div>
            {r.otherUseExplanation && <div><dt className="font-semibold">Other use</dt><dd>{r.otherUseExplanation}</dd></div>}
            {r.currentProduct && <div><dt className="font-semibold">Current product</dt><dd>{r.currentProduct}</dd></div>}
            {r.productPreferences && <div><dt className="font-semibold">Preferences</dt><dd className="whitespace-pre-line">{r.productPreferences}</dd></div>}
            {r.deliveryInstructions && <div><dt className="font-semibold">Delivery instructions</dt><dd className="whitespace-pre-line">{r.deliveryInstructions}</dd></div>}
            {r.additionalNotes && <div><dt className="font-semibold">Notes from requester</dt><dd className="whitespace-pre-line">{r.additionalNotes}</dd></div>}
          </dl>
        </section>
        <section className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
          <h2 className="font-heading text-xl font-bold">Contact</h2>
          <dl className="mt-3 space-y-2 text-[15px]">
            <div><dt className="font-semibold">Name</dt><dd>{r.contactName} ({r.contactRole})</dd></div>
            <div><dt className="font-semibold">Email</dt><dd>{r.contactEmail}</dd></div>
            <div><dt className="font-semibold">Phone</dt><dd>{r.contactPhone ?? "—"} (prefers {r.preferredContact})</dd></div>
            <div><dt className="font-semibold">Submitted</dt><dd>{new Date(r.createdAt).toLocaleString()}</dd></div>
          </dl>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-[#E5DCCB] bg-white p-5" aria-labelledby="listing-heading">
        <h2 id="listing-heading" className="font-heading text-xl font-bold">Public directory listing</h2>
        <dl className="mt-3 space-y-2 text-[15px]">
          <div><dt className="font-semibold">Opt-in consent</dt><dd>{r.publicListingConsent ? `Yes${r.publicListingConsentAt ? ` · ${new Date(r.publicListingConsentAt).toLocaleString()}` : ""}` : "No — this request can never be published."}</dd></div>
          <div><dt className="font-semibold">Listing status</dt><dd>{r.publicListingStatus}</dd></div>
          {(r.publicListingReviewedBy || r.publicListingReviewedAt) && (
            <div><dt className="font-semibold">Last reviewed</dt><dd>{r.publicListingReviewedBy ?? "—"}{r.publicListingReviewedAt ? ` · ${new Date(r.publicListingReviewedAt).toLocaleString()}` : ""}</dd></div>
          )}
          {r.publicListingSummary && <div><dt className="font-semibold">Current public note</dt><dd className="whitespace-pre-line">{r.publicListingSummary}</dd></div>}
        </dl>
        {r.publicListingConsent ? (
          <form action={updatePublicListing.bind(null, r.id)} className="mt-4 space-y-3">
            <div>
              <label htmlFor="listing-summary" className="block text-sm font-semibold">Public note (optional, plain text, max {PUBLIC_LISTING_SUMMARY_MAX_LENGTH} characters)</label>
              <input
                id="listing-summary"
                name="summary"
                defaultValue={r.publicListingSummary ?? ""}
                maxLength={PUBLIC_LISTING_SUMMARY_MAX_LENGTH}
                placeholder="e.g. Requested vegan sugar for temple kitchen"
                className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" name="action" value="publish" className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-terracotta-deeper px-6 py-2.5 font-semibold text-white hover:bg-[#7E3B1E]">
                Approve &amp; publish
              </button>
              <button type="submit" name="action" value="unpublish" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-charcoal px-6 py-2.5 font-semibold hover:bg-cream">
                Unpublish
              </button>
            </div>
            <p className="text-sm text-[#6B5E4F]">Publishing lists only the temple name, city, state, website, and this note. Unpublishing removes the temple from the public directory immediately.</p>
          </form>
        ) : (
          <p className="mt-4 rounded-xl bg-cream p-4 text-[15px] text-[#4A4238]">
            This request did not opt in to public listing, so it cannot be published. Only the
            temple may opt in via the request form.
          </p>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-[#E5DCCB] bg-white p-5">
        <h2 className="font-heading text-xl font-bold">Update status</h2>
        <p className="mt-1 text-sm text-[#6B5E4F]">Approval does not mean ordered. Ordered does not mean delivered. Changes are recorded with your email and timestamp.</p>
        <form action={updateRequestStatus.bind(null, r.id)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="status" className="block text-sm font-semibold">New status</label>
            <select id="status" name="status" defaultValue={r.status} className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5">
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex-[2]">
            <label htmlFor="deliveryNotes" className="block text-sm font-semibold">Internal delivery / order notes</label>
            <input id="deliveryNotes" name="deliveryNotes" defaultValue={r.deliveryNotes ?? ""} placeholder="e.g. Ordered 50 lb from supplier X on …" className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5" />
          </div>
          <button type="submit" className="rounded-full bg-charcoal px-6 py-2.5 font-semibold text-white">Save</button>
        </form>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
          <h2 className="font-heading text-xl font-bold">Internal notes</h2>
          <form action={addRequestNote.bind(null, r.id)} className="mt-3 space-y-3">
            <label htmlFor="note-body" className="block text-sm font-semibold">Add a note (visible to admins only)</label>
            <textarea id="note-body" name="body" rows={3} maxLength={2000} required className="w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5" />
            <button type="submit" className="rounded-full border border-charcoal px-5 py-2 font-semibold">Add note</button>
          </form>
          <ul className="mt-4 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-cream p-3 text-[15px]">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="mt-1 text-sm text-[#6B5E4F]">{n.authorEmail} · {new Date(n.createdAt).toLocaleString()}</p>
              </li>
            ))}
            {notes.length === 0 && <li className="text-[#6B5E4F]">No notes yet.</li>}
          </ul>
        </section>
        <section className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
          <h2 className="font-heading text-xl font-bold">Status history</h2>
          <ol className="mt-3 space-y-2 text-[15px]">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl bg-cream p-3">
                <span className="font-semibold">{h.fromStatus ? STATUS_LABELS[h.fromStatus] ?? h.fromStatus : "—"} → {STATUS_LABELS[h.toStatus] ?? h.toStatus}</span>
                <span className="block text-sm text-[#6B5E4F]">{h.changedBy} · {new Date(h.createdAt).toLocaleString()}</span>
              </li>
            ))}
            {history.length === 0 && <li className="text-[#6B5E4F]">No history.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
