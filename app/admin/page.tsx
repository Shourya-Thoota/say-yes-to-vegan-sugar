import Link from "next/link";
import { and, count, desc, ilike, or, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireAdmin, signOut } from "@/lib/auth";
import { contactInquiries, donationRequests, supportOffers } from "@/lib/schema";
import { STATUS_LABELS } from "@/lib/csv";

export const metadata = { title: "Administrator Dashboard", robots: { index: false, follow: false } };

const PAGE_SIZE = 20;

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string; tab?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const admin = await requireAdmin();
  if (!admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-heading text-3xl font-bold">Access denied</h1>
        <p className="mt-3">Administrator sign-in is required.</p>
        <Link href="/admin/signin" className="mt-5 inline-block rounded-full bg-charcoal px-6 py-3 font-semibold text-white">Sign in</Link>
      </div>
    );
  }
  const db = getDb();
  if (!db) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><h1 className="font-heading text-3xl font-bold">Database unavailable</h1><p className="mt-3">DATABASE_URL is not configured.</p></div>;
  }

  const tab = sp.tab ?? "requests";
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [reqCount] = await db.select({ n: count() }).from(donationRequests);
  const [supCount] = await db.select({ n: count() }).from(supportOffers);
  const [conCount] = await db.select({ n: count() }).from(contactInquiries);

  const filters = [];
  if (status) filters.push(eq(donationRequests.status, status));
  if (q) {
    const like = `%${q}%`;
    filters.push(
      // biome-ignore lint: drizzle or overload
      or(
        ilike(donationRequests.templeName, like),
        ilike(donationRequests.city, like),
        ilike(donationRequests.publicRef, like),
        ilike(donationRequests.contactEmail, like)
      )!
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(donationRequests)
    .where(where)
    .orderBy(desc(donationRequests.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ n: total }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(donationRequests)
    .where(where);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const supports = tab === "support" ? await db.select().from(supportOffers).orderBy(desc(supportOffers.createdAt)).limit(50) : [];
  const contacts = tab === "contact" ? await db.select().from(contactInquiries).orderBy(desc(contactInquiries.createdAt)).limit(50) : [];

  const base = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    p.set("page", String(page));
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/admin?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Administrator dashboard</h1>
          <p className="mt-1 text-[#4A4238]">Signed in as {admin.email}</p>
        </div>
        <div className="flex gap-3">
          <a href="/api/admin/export?type=requests" className="rounded-full border border-charcoal px-5 py-2.5 font-semibold hover:bg-cream">Export CSV</a>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="rounded-full bg-charcoal px-5 py-2.5 font-semibold text-white hover:bg-black">Sign out</button>
          </form>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Donation requests", n: reqCount.n },
          { label: "Support offers", n: supCount.n },
          { label: "Contact inquiries", n: conCount.n },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
            <p className="font-heading text-4xl font-bold">{c.n}</p>
            <p className="text-[#4A4238]">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-2" role="tablist" aria-label="Inbox">
        {[
          { id: "requests", label: "Requests" },
          { id: "support", label: "Support inbox" },
          { id: "contact", label: "Contact inbox" },
        ].map((t) => (
          <Link key={t.id} href={base({ tab: t.id })} role="tab" aria-selected={tab === t.id} className={`rounded-full px-5 py-2.5 font-semibold ${tab === t.id ? "bg-charcoal text-white" : "border border-[#D8CCB8] bg-white"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "requests" && (
        <section className="mt-6">
          <form method="get" action="/admin" className="flex flex-col gap-3 rounded-2xl border border-[#E5DCCB] bg-white p-4 sm:flex-row">
            <input type="hidden" name="tab" value="requests" />
            <input name="q" defaultValue={q} placeholder="Search temple, city, ref, email" aria-label="Search requests" className="flex-1 rounded-xl border border-[#D8CCB8] px-4 py-2.5" />
            <select name="status" defaultValue={status} aria-label="Filter by status" className="rounded-xl border border-[#D8CCB8] px-4 py-2.5">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="submit" className="rounded-full bg-charcoal px-6 py-2.5 font-semibold text-white">Search</button>
          </form>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#E5DCCB] bg-white">
            <table className="w-full min-w-[760px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-[#E5DCCB] text-sm text-[#6B5E4F]">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Temple</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F0E9DA] last:border-0">
                    <td className="px-4 py-3 font-mono text-sm"><Link className="underline" href={`/admin/requests/${r.id}`}>{r.publicRef}</Link></td>
                    <td className="px-4 py-3 font-semibold">{r.templeName}</td>
                    <td className="px-4 py-3">{r.city}, {r.state}</td>
                    <td className="px-4 py-3">{r.quantityPounds} lb</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-[#6B5E4F]">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[#6B5E4F]">No requests match this search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3 text-[15px]">
            <span>Page {page} of {totalPages} ({total} total)</span>
            {page > 1 && <Link className="underline" href={base({ page: String(page - 1) })}>Previous</Link>}
            {page < totalPages && <Link className="underline" href={base({ page: String(page + 1) })}>Next</Link>}
          </div>
        </section>
      )}

      {tab === "support" && (
        <section className="mt-6 space-y-3">
          {supports.map((s) => (
            <article key={s.id} className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
              <p className="font-bold">{s.name} <span className="font-normal text-[#6B5E4F]">· {s.email} · {s.supportType}</span></p>
              <p className="mt-2 whitespace-pre-line">{s.message}</p>
              <p className="mt-2 font-mono text-sm text-[#6B5E4F]">{s.publicRef} · {new Date(s.createdAt).toLocaleString()}</p>
            </article>
          ))}
          {supports.length === 0 && <p className="text-[#6B5E4F]">No support offers yet.</p>}
        </section>
      )}

      {tab === "contact" && (
        <section className="mt-6 space-y-3">
          {contacts.map((c) => (
            <article key={c.id} className="rounded-2xl border border-[#E5DCCB] bg-white p-5">
              <p className="font-bold">{c.name} <span className="font-normal text-[#6B5E4F]">· {c.email}</span></p>
              <p className="font-semibold">{c.subject}</p>
              <p className="mt-2 whitespace-pre-line">{c.message}</p>
              <p className="mt-2 font-mono text-sm text-[#6B5E4F]">{c.publicRef} · {new Date(c.createdAt).toLocaleString()}</p>
            </article>
          ))}
          {contacts.length === 0 && <p className="text-[#6B5E4F]">No contact inquiries yet.</p>}
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full bg-cream px-3 py-1 text-sm font-semibold text-charcoal">
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
