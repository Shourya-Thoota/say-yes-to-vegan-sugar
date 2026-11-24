"use client";

import { useMemo, useState } from "react";
import {
  EMPTY_INQUIRY_FIELDS,
  INQUIRY_LIMITS,
  buildInquiryDraft,
  buildInquiryMailto,
  buildInquirySubject,
  sanitizeInquiryFields,
  type InquiryFields,
} from "@/lib/inquiry";
import { getSiteUrl } from "@/lib/share";

const FIELD_DEFS: { key: keyof InquiryFields; label: string; placeholder: string }[] = [
  { key: "brand", label: "Brand / manufacturer", placeholder: "For example: Example Milling Co." },
  { key: "productName", label: "Exact product name", placeholder: "For example: Granulated White Sugar" },
  { key: "packageSize", label: "Package size", placeholder: "For example: 4 lb / 1.81 kg" },
  { key: "countryRegion", label: "Country / region of purchase", placeholder: "For example: United States" },
  { key: "retailer", label: "Retailer", placeholder: "For example: Neighborhood grocery" },
  { key: "facilityLot", label: "Facility / lot code (if shown)", placeholder: "Copy exactly from the package" },
];

export function InquiryBuilder({ guideUrl }: { guideUrl: string }) {
  const [fields, setFields] = useState<InquiryFields>(EMPTY_INQUIRY_FIELDS);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const clean = useMemo(() => sanitizeInquiryFields(fields), [fields]);
  const resolvedGuide = guideUrl || (typeof window !== "undefined" ? `${getSiteUrl()}/choosing-sugar` : "");
  const draft = useMemo(() => buildInquiryDraft(clean, resolvedGuide), [clean, resolvedGuide]);
  const mailto = useMemo(() => buildInquiryMailto(clean, resolvedGuide), [clean, resolvedGuide]);
  const subject = useMemo(() => buildInquirySubject(clean), [clean]);

  function setField(key: keyof InquiryFields, value: string) {
    const max = INQUIRY_LIMITS[key];
    setFields((prev) => ({ ...prev, [key]: value.slice(0, max * 2) }));
    setCopyStatus("idle");
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(draft);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    window.setTimeout(() => setCopyStatus("idle"), 4000);
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELD_DEFS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`inquiry-${f.key}`} className="block text-[15px] font-semibold text-charcoal">
              {f.label} <span className="font-normal text-[#6B5E4F]">(optional)</span>
            </label>
            <input
              id={`inquiry-${f.key}`}
              type="text"
              value={fields[f.key]}
              maxLength={INQUIRY_LIMITS[f.key] * 2}
              placeholder={f.placeholder}
              autoComplete="off"
              onChange={(e) => setField(f.key, e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[#D8CCB8] bg-white px-4 py-3 text-base text-charcoal placeholder:text-[#9A8F7F] focus:border-terracotta-deeper focus:outline-none"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-[#6B5E4F]">
        All fields are optional. Nothing is sent or stored — the draft stays in your browser. Overlong entries are shortened to keep messages usable.
      </p>

      <div className="mt-5">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#6B5E4F]">
          Draft preview
        </p>
        <output
          aria-live="polite"
          aria-label="Inquiry draft preview"
          className="mt-2 block whitespace-pre-line break-words rounded-xl border border-[#E5DCCB] bg-[#FDFBF7] p-5 leading-relaxed"
        >
          {draft}
        </output>
        <p className="mt-2 text-sm text-[#6B5E4F]">
          Subject line: <span className="font-semibold text-charcoal">{subject}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[44px] rounded-xl bg-charcoal px-6 py-2.5 font-semibold text-white hover:bg-black"
        >
          {copyStatus === "copied" ? "Copied to clipboard" : "Copy Inquiry"}
        </button>
        <a
          href={mailto}
          className="inline-block min-h-[44px] rounded-xl border border-charcoal bg-white px-6 py-2.5 text-center font-semibold text-charcoal hover:bg-[#EFE7D8]"
        >
          Open email draft
        </a>
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm font-medium text-terracotta-deeper">
        {copyStatus === "copied"
          ? "Inquiry text copied. Paste it into your message to the manufacturer."
          : copyStatus === "error"
            ? "Copy did not work in this browser. Please select the preview above and copy it manually."
            : ""}
      </p>
      <p className="mt-2 text-sm text-[#6B5E4F]">
        “Open email draft” opens your own email app with this text filled in — it does
        not send anything. Add the manufacturer&apos;s address yourself; we never
        suggest one.
      </p>
    </div>
  );
}
