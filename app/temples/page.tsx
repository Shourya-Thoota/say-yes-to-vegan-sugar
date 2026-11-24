import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { US_STATES } from "@/lib/us-states";
import { countPublishedTemples, getPublishedTemples, toSafeHttpUrl } from "@/lib/public-directory";

export const metadata = {
  title: "Temple Directory",
  description:
    "An opt-in public directory of Hindu temples participating in Temple Initiative, shown only after a temple opts in and is reviewed.",
};

export default async function TemplesPage({
  searchParams,
}: {
  searchParams?: Promise<{ state?: string; q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const state = (sp.state ?? "").trim().toUpperCase();
  const q = (sp.q ?? "").trim();
  const activeState = /^[A-Z]{2}$/.test(state) ? state : "";
  let listings: Awaited<ReturnType<typeof getPublishedTemples>> = [];
  let total = 0;
  let unavailable = false;
  try {
    listings = await getPublishedTemples({ state: activeState, q });
    total = await countPublishedTemples();
  } catch {
    // Database is configured but unreachable or erroring: degrade gracefully
    // instead of crashing /temples with a 500. The error itself was already
    // reported (fixed message, no PII) inside lib/public-directory.ts.
    unavailable = true;
  }
  const isFiltered = activeState !== "" || q !== "";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>Community · opt-in only</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Temple directory.</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#4A4238]">
        Hindu temples taking part in Temple Initiative may choose to appear here. A temple is
        listed <strong>only</strong> after an authorized representative explicitly opts in and a
        Temple Initiative reviewer approves the listing.
      </p>

      <form
        method="get"
        action="/temples"
        className="mt-8 flex flex-col gap-3 rounded-2xl border border-[#E5DCCB] bg-white p-4 sm:flex-row"
      >
        <div className="flex-1">
          <label htmlFor="directory-q" className="sr-only">
            Search by temple name or city
          </label>
          <input
            id="directory-q"
            name="q"
            defaultValue={q}
            placeholder="Search by temple name or city"
            maxLength={120}
            autoComplete="off"
            className="w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5"
          />
        </div>
        <div>
          <label htmlFor="directory-state" className="sr-only">
            Filter by state
          </label>
          <select
            id="directory-state"
            name="state"
            defaultValue={activeState}
            className="w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5 sm:w-auto"
          >
            <option value="">All states</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-charcoal px-6 py-2.5 font-semibold text-white hover:bg-black"
        >
          Search
        </button>
        {isFiltered && (
          <Link
            href="/temples"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#D8CCB8] px-6 py-2.5 text-center font-semibold hover:bg-cream"
          >
            Clear
          </Link>
        )}
      </form>

      {unavailable ? (
        <section
          aria-live="polite"
          role="status"
          className="mt-6 rounded-2xl border border-[#E5DCCB] bg-white p-8 text-center"
        >
          <h2 className="font-heading text-2xl font-bold">The directory is temporarily unavailable.</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[#4A4238]">
            We could not load temple listings just now. Please try again in a little while.
            If your temple would like to take part, you can still start a donation request
            or learn how to check sugar processing.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/request-sugar"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-terracotta-deeper px-6 py-3 font-semibold text-white hover:bg-[#7E3B1E]"
            >
              Request Sugar for Your Temple
            </Link>
            <Link
              href="/choosing-sugar"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-terracotta-deeper px-6 py-3 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
            >
              Choosing-Sugar Guide
            </Link>
          </div>
        </section>
      ) : total === 0 ? (
        <section
          aria-live="polite"
          className="mt-6 rounded-2xl border border-[#E5DCCB] bg-white p-8 text-center"
        >
          <h2 className="font-heading text-2xl font-bold">No temples are listed yet.</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[#4A4238]">
            Listings appear here only after a temple opts in and is reviewed by Temple
            Initiative. If your temple would like to take part, start with a donation request
            or learn how to check sugar processing.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/request-sugar"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-terracotta-deeper px-6 py-3 font-semibold text-white hover:bg-[#7E3B1E]"
            >
              Request Sugar for Your Temple
            </Link>
            <Link
              href="/choosing-sugar"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-terracotta-deeper px-6 py-3 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
            >
              Choosing-Sugar Guide
            </Link>
          </div>
        </section>
      ) : listings.length === 0 ? (
        <section
          aria-live="polite"
          className="mt-6 rounded-2xl border border-[#E5DCCB] bg-white p-8 text-center"
        >
          <h2 className="font-heading text-2xl font-bold">No temples match this search.</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[#4A4238]">
            Try a different temple name, city, or state — or browse the full directory.
          </p>
          <Link
            href="/temples"
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-terracotta-deeper px-6 py-3 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
          >
            View all listed temples
          </Link>
        </section>
      ) : (
        <>
          <p className="mt-6 text-[15px] text-[#6B5E4F]" role="status" aria-live="polite">
            Showing {listings.length} of {total} listed {total === 1 ? "temple" : "temples"}
            {isFiltered ? " matching this search" : ""}.
          </p>
          <ul className="mt-3 space-y-4">
            {listings.map((t) => {
              const safeUrl = toSafeHttpUrl(t.templeWebsite);
              return (
                <li
                  key={t.publicRef}
                  className="rounded-2xl border border-[#E5DCCB] bg-white p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-2xl font-bold">{t.templeName}</h2>
                      <p className="mt-1 text-[#4A4238]">
                        {t.city}, {t.state}
                      </p>
                    </div>
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-terracotta-deeper px-5 py-2 font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
                      >
                        Visit website
                      </a>
                    )}
                  </div>
                  {t.publicListingSummary && (
                    <p className="mt-3 leading-relaxed text-[#4A4238]">{t.publicListingSummary}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <aside className="mt-8 rounded-2xl bg-cream p-5 text-[15px] leading-relaxed text-[#4A4238]">
        <h2 className="font-heading text-lg font-bold text-charcoal">
          What this directory means — and does not mean
        </h2>
        <p className="mt-2">
          Listing reflects voluntary, opt-in participation reviewed by Temple Initiative. It is
          not a certification, kitchen audit, or religious endorsement. Practices can change —
          please confirm current practices directly with the temple.
        </p>
        <p className="mt-2">
          A temple representative may ask to be removed at any time via the{" "}
          <Link href="/contact" className="underline">
            Contact page
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
