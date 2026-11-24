import Link from "next/link";
import QRCode from "qrcode";
import { BrandMark } from "@/components/brand-mark";
import { POSTER_CAUTION, POSTER_STEPS, getChoosingSugarUrl, getSiteBaseUrl } from "@/lib/poster";
import { PrintButton } from "./print-button";

export const metadata = {
  title: "Temple-Kitchen Guide",
  description:
    "A one-page printable sugar check for temple kitchens: identify the product, check processing information, and record what you checked.",
};

export default async function PosterPage() {
  const base = getSiteBaseUrl(process.env);
  const choosingUrl = getChoosingSugarUrl(process.env);

  let qrSvg: string | null = null;
  try {
    qrSvg = await QRCode.toString(choosingUrl, {
      type: "svg",
      margin: 1,
      width: 160,
      errorCorrectionLevel: "M",
    });
  } catch {
    qrSvg = null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 poster-page">
      <p className="no-print text-sm">
        <Link href="/choosing-sugar" className="font-semibold text-terracotta-deeper underline underline-offset-4">
          ← Back to the choosing-sugar guide
        </Link>
      </p>

      <article
        aria-labelledby="poster-heading"
        className="poster-sheet mt-4 rounded-2xl border border-[#D8CCB8] bg-white p-6 sm:p-10"
      >
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 shrink-0" />
          <div className="leading-tight">
            <p className="font-heading text-lg font-bold">Temple Initiative</p>
            <p className="text-sm text-[#6B5E4F]">Say Yes to Vegan Sugar</p>
          </div>
        </div>

        <h1 id="poster-heading" className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">
          A simple sugar check for your temple kitchen.
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-[#4A4238]">{POSTER_CAUTION}</p>

        <ol className="mt-6 space-y-4">
          {POSTER_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] font-heading text-lg font-bold text-terracotta-deeper"
              >
                {i + 1}
              </span>
              <div>
                <h2 className="font-heading text-lg font-bold leading-snug">{step.title}</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-[#4A4238]">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-xl bg-[#F5F0E8] p-5">
          <h2 className="font-heading text-lg font-bold">Our kitchen record</h2>
          <p className="mt-1 text-sm text-[#6B5E4F]">
            Fill in by hand after printing. Keep with your purchasing records.
          </p>
          <dl className="mt-4 space-y-4 text-[15px]">
            {["Product / brand", "Supplier", "Date checked", "Documentation / person who checked"].map(
              (label) => (
                <div key={label}>
                  <dt className="font-semibold">{label}</dt>
                  <dd
                    aria-hidden="true"
                    className="mt-1 h-8 border-b-2 border-[#B9A98F]"
                  >
                    &nbsp;
                  </dd>
                </div>
              )
            )}
          </dl>
        </div>

        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-bold">Full guide</h2>
            <p className="mt-1 break-words text-[15px] leading-relaxed">
              <span className="font-semibold">Read more:</span>{" "}
              <span className="font-mono text-[14px]">{choosingUrl}</span>
            </p>
            <p className="mt-1 text-sm text-[#6B5E4F]">{base}/</p>
          </div>
          <div className="shrink-0 text-center">
            {qrSvg ? (
              <div
                role="img"
                aria-label={`QR code linking to ${choosingUrl}`}
                className="inline-block rounded-lg border border-[#D8CCB8] bg-white p-2"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <p className="max-w-[180px] text-sm text-[#6B5E4F]">
                QR code unavailable. Type the address above into your browser.
              </p>
            )}
            <p className="mt-2 text-xs text-[#6B5E4F]">Scan for the full guide</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-[#6B5E4F]">
          This sheet supports purchasing decisions; it does not certify products. Information may
          change — appearance alone cannot establish how sugar was processed.
        </p>
      </article>

      <PrintButton />

      <p className="no-print mt-6 text-sm text-[#6B5E4F]">
        Also linked from the{" "}
        <Link href="/choosing-sugar" className="font-semibold text-terracotta-deeper underline underline-offset-4">
          choosing-sugar guide
        </Link>
        .
      </p>
    </div>
  );
}
