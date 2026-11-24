"use client";

import { useState } from "react";
import { SPONSORSHIP_TIERS, formatCentsUsd, type SponsorshipTierCode } from "@/lib/sponsorship";

const ORDER: SponsorshipTierCode[] = ["bag_10", "bag_25", "bag_50", "bag_100"];

export function SponsorForm() {
  const [tierCode, setTierCode] = useState<SponsorshipTierCode>("bag_25");
  const [displayName, setDisplayName] = useState("");
  const [recognition, setRecognition] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          sponsorDisplayName: displayName,
          publicRecognitionConsent: recognition,
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
      <h2 id="sponsor-checkout-heading" className="font-heading text-2xl font-bold">
        Choose your sponsorship
      </h2>
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
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="tier"
                    value={code}
                    checked={selected}
                    onChange={() => setTierCode(code)}
                    className="h-5 w-5 accent-[#7E3B1E]"
                  />
                  <span>
                    <span className="block font-bold">{t.label}</span>
                    <span className="block text-sm text-[#6B5E4F]">about {t.estimatedPounds} lb of vegan sugar</span>
                  </span>
                </span>
                <span className="font-heading text-lg font-bold">{formatCentsUsd(t.amountCents)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="sponsor-name" className="block text-sm font-semibold">
          Display name <span className="font-normal text-[#6B5E4F]">(optional, shown publicly only with your permission)</span>
        </label>
        <input
          id="sponsor-name"
          name="sponsorDisplayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          autoComplete="off"
          placeholder="e.g. The Patel Family"
          className="mt-1 w-full rounded-xl border border-[#D8CCB8] px-4 py-2.5"
        />
      </div>

      <div className="mt-3 flex items-start gap-3">
        <input
          id="sponsor-recognition"
          type="checkbox"
          checked={recognition}
          onChange={(e) => setRecognition(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[#7E3B1E]"
        />
        <label htmlFor="sponsor-recognition" className="text-[15px] leading-relaxed">
          You may list my display name in the transparency ledger. Leave unchecked to stay anonymous.
        </label>
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-xl bg-cream p-4">
        <input
          id="sponsor-terms"
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[#7E3B1E]"
          required
        />
        <label htmlFor="sponsor-terms" className="text-[15px] leading-relaxed">
          I understand this contribution supports Temple Initiative&apos;s vegan-sugar work, is{" "}
          <strong>not a tax-deductible charitable donation</strong>, and is{" "}
          <strong>non-refundable</strong> except for billing errors. I have read the terms below.
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-[#B3261E] bg-[#FDECEA] p-4 text-[15px]">
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
      <p className="mt-2 text-sm text-[#6B5E4F]">
        Secure payment is handled by Stripe. We never see or store your card details.
      </p>
    </form>
  );
}
