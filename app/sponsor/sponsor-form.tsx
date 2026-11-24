"use client";

import { useMemo, useState } from "react";
import { SPONSORSHIP_TIERS, SPONSORSHIP_TERMS_VERSION, formatCentsUsd, type SponsorshipTierCode } from "@/lib/sponsorship";

const ORDER: SponsorshipTierCode[] = ["bag_10", "bag_25", "bag_50", "bag_100"];

function newAttemptKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    }
  } catch {
    // fall through
  }
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`.slice(0, 32);
}

export function SponsorForm() {
  const [tierCode, setTierCode] = useState<SponsorshipTierCode>("bag_25");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One stable attempt key per form instance: repeated clicks/retries reuse
  // the same key so the server returns the same usable Stripe session.
  const attemptKey = useMemo(() => newAttemptKey(), []);

  async function onCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!terms) {
      setError("Please acknowledge the sponsorship terms before continuing.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sponsorship/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tierCode,
          attemptKey,
          termsVersion: SPONSORSHIP_TERMS_VERSION,
          acknowledgesTerms: true,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        errors?: Record<string, string>;
        message?: string;
      } | null;
      if (res.ok && data?.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      const first =
        data?.errors?._form ??
        data?.errors?.tierCode ??
        data?.errors?.attemptKey ??
        data?.errors?.termsVersion ??
        data?.errors?.acknowledgesTerms ??
        data?.message ??
        "We could not start checkout. Please try again.";
      setError(first);
    } catch {
      setError("We could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onCheckout}
      className="mt-6 rounded-2xl border border-[#E5DCCB] bg-white p-5 sm:p-6"
      aria-labelledby="sponsor-checkout-heading"
    >
      <h2 id="sponsor-checkout-heading" className="break-words font-heading text-2xl font-bold">
        Choose your sponsorship
      </h2>
      <p className="mt-1 break-words text-sm text-[#6B5E4F]">
        Provisional launch amounts — subject to operator review. Pound figures are approximate
        delivery estimates, not guaranteed quantities.
      </p>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-[#4A4238]">Sponsorship amount (fixed tiers)</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Sponsorship tiers">
          {ORDER.map((code) => {
            const t = SPONSORSHIP_TIERS[code];
            const selected = tierCode === code;
            return (
              <label
                key={code}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[15px] ${
                  selected ? "border-terracotta-deeper bg-terracotta-soft" : "border-[#D8CCB8] hover:bg-cream"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="radio"
                    name="tier"
                    value={code}
                    checked={selected}
                    onChange={() => setTierCode(code)}
                    className="h-5 w-5 shrink-0 accent-[#7E3B1E]"
                  />
                  <span className="min-w-0">
                    <span className="block break-words font-bold">{t.label}</span>
                    <span className="block break-words text-sm text-[#6B5E4F]">about {t.estimatedPounds} lb of vegan sugar (estimate)</span>
                  </span>
                </span>
                <span className="shrink-0 font-heading text-lg font-bold">{formatCentsUsd(t.amountCents)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-3 flex items-start gap-3 rounded-xl bg-cream p-4">
        <input
          id="sponsor-terms"
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[#7E3B1E]"
          required
        />
        <label htmlFor="sponsor-terms" className="break-words text-[15px] leading-relaxed">
          I understand this contribution supports Temple Initiative&apos;s vegan-sugar work, is{" "}
          <strong>not a tax-deductible charitable donation</strong>, and is{" "}
          <strong>non-refundable</strong> except for billing errors. I have read the terms below.
          Sponsorships support the program generally and are not promised to map to any specific
          delivery.
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 break-words rounded-xl border border-[#B3261E] bg-[#FDECEA] p-4 text-[15px]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-terracotta-deeper px-6 py-3 font-semibold text-white hover:bg-[#7E3B1E] disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Starting secure checkout…" : "Continue to Stripe Checkout"}
      </button>
      <p className="mt-2 break-words text-sm text-[#6B5E4F]">
        Secure payment is handled by Stripe. We never see or store your card details.
      </p>
    </form>
  );
}
