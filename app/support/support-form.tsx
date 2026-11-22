"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supportOfferSchema, type SupportOfferInput } from "@/lib/validation";
import { FieldError, inputClassName, labelClassName } from "@/components/ui";

const TYPES = [
  { value: "donate_sugar", label: "Donate suitable sugar" },
  { value: "coordinate", label: "Help coordinate deliveries" },
  { value: "introduce", label: "Introduce the initiative to a temple" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other", label: "Other" },
] as const;

export function SupportForm({ disabled }: { disabled?: boolean }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [key] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)));

  const form = useForm<SupportOfferInput>({
    resolver: zodResolver(supportOfferSchema),
    defaultValues: { company: "", idempotencyKey: key, privacyConsent: undefined as unknown as true } as unknown as SupportOfferInput,
  });
  const { register, formState } = form;
  const e = (n: keyof SupportOfferInput) => formState.errors[n]?.message as string | undefined;

  async function onSubmit(values: SupportOfferInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, idempotencyKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setServerError(data?.errors?._form ?? data?.message ?? "We could not save your message. Please try again.");
        return;
      }
      setRef(data.ref);
      window.scrollTo({ top: 0 });
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ref) {
    return (
      <div className="rounded-2xl border border-[#E5DCCB] bg-white p-8 text-center" role="status">
        <p className="font-heading text-3xl font-bold">Thank you for offering to help.</p>
        <p className="mt-3 text-[#4A4238]">We have received your message and will be in touch if your help is a good fit. Your reference is <strong className="font-mono">{ref}</strong>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5 rounded-2xl border border-[#E5DCCB] bg-white p-6 sm:p-8" aria-label="Support offer form">
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Company<input type="text" tabIndex={-1} autoComplete="off" {...register("company")} /></label>
      </div>
      {serverError && <p role="alert" className="rounded-xl border border-[#B3261E] bg-[#FDECEA] p-4 font-medium">{serverError}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="s-name" className={labelClassName()}>Name *</label>
          <input id="s-name" autoComplete="name" className={inputClassName(!!formState.errors.name)} {...register("name")} />
          <FieldError id="s-name-error" message={formState.errors.name?.message} />
        </div>
        <div>
          <label htmlFor="s-email" className={labelClassName()}>Email *</label>
          <input id="s-email" type="email" autoComplete="email" className={inputClassName(!!formState.errors.email)} {...register("email")} />
          <FieldError id="s-email-error" message={formState.errors.email?.message} />
        </div>
      </div>
      <div>
        <label htmlFor="s-org" className={labelClassName()}>Organization (optional)</label>
        <input id="s-org" autoComplete="organization" className={inputClassName(false)} {...register("organization")} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="s-city" className={labelClassName()}>City (optional)</label>
          <input id="s-city" autoComplete="address-level2" className={inputClassName(false)} {...register("city")} />
        </div>
        <div>
          <label htmlFor="s-state" className={labelClassName()}>State (optional)</label>
          <input id="s-state" maxLength={2} placeholder="e.g. TX" className={inputClassName(false)} {...register("state")} />
        </div>
      </div>
      <div>
        <label htmlFor="s-type" className={labelClassName()}>How would you like to help? *</label>
        <select id="s-type" className={inputClassName(!!formState.errors.supportType)} {...register("supportType")}>
          <option value="">Choose one</option>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <FieldError id="s-type-error" message={e("supportType")} />
      </div>
      <div>
        <label htmlFor="s-msg" className={labelClassName()}>Message *</label>
        <textarea id="s-msg" rows={5} maxLength={2000} className={inputClassName(!!formState.errors.message)} {...register("message")} />
                  <FieldError id="s-msg-error" message={formState.errors.message?.message ?? undefined} />
      </div>
      <div className="rounded-xl bg-cream p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" {...register("privacyConsent")} className="mt-1 h-5 w-5 accent-[#9C4A26]" />
          <span className="text-[15px]">I agree to the <a href="/privacy" target="_blank" className="underline">Privacy Policy</a> and consent to being contacted about my offer. *</span>
        </label>
        <FieldError id="s-consent-error" message={formState.errors.privacyConsent?.message} />
      </div>
      <button type="submit" disabled={disabled || submitting} className="rounded-full bg-terracotta-deeper px-8 py-3 font-semibold text-white hover:bg-[#7E3B1E] disabled:opacity-50">
        {submitting ? "Sending…" : "Offer Your Support"}
      </button>
    </form>
  );
}
