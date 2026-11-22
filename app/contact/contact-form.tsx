"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactInput } from "@/lib/validation";
import { FieldError, inputClassName, labelClassName } from "@/components/ui";

export function ContactForm({ disabled }: { disabled?: boolean }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [key] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)));

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { company: "", idempotencyKey: key } as unknown as ContactInput,
  });
  const { register, formState } = form;

  async function onSubmit(values: ContactInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, idempotencyKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setServerError(data?.errors?._form ?? "We could not save your message. Please try again.");
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
        <p className="font-heading text-3xl font-bold">Message received.</p>
        <p className="mt-3 text-[#4A4238]">Thank you for writing to us. Your reference is <strong className="font-mono">{ref}</strong>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5 rounded-2xl border border-[#E5DCCB] bg-white p-6 sm:p-8" aria-label="Contact form">
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Company<input type="text" tabIndex={-1} autoComplete="off" {...register("company")} /></label>
      </div>
      {serverError && <p role="alert" className="rounded-xl border border-[#B3261E] bg-[#FDECEA] p-4 font-medium">{serverError}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={labelClassName()}>Name *</label>
          <input id="c-name" autoComplete="name" className={inputClassName(!!formState.errors.name)} {...register("name")} />
          <FieldError id="c-name-error" message={formState.errors.name?.message} />
        </div>
        <div>
          <label htmlFor="c-email" className={labelClassName()}>Email *</label>
          <input id="c-email" type="email" autoComplete="email" className={inputClassName(!!formState.errors.email)} {...register("email")} />
          <FieldError id="c-email-error" message={formState.errors.email?.message} />
        </div>
      </div>
      <div>
        <label htmlFor="c-subject" className={labelClassName()}>Subject *</label>
        <input id="c-subject" maxLength={200} className={inputClassName(!!formState.errors.subject)} {...register("subject")} />
        <FieldError id="c-subject-error" message={formState.errors.subject?.message} />
      </div>
      <div>
        <label htmlFor="c-msg" className={labelClassName()}>Message *</label>
        <textarea id="c-msg" rows={6} maxLength={3000} className={inputClassName(!!formState.errors.message)} {...register("message")} />
        <FieldError id="c-msg-error" message={formState.errors.message?.message} />
      </div>
      <div className="rounded-xl bg-cream p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" {...register("privacyConsent")} className="mt-1 h-5 w-5 accent-[#9C4A26]" />
          <span className="text-[15px]">I agree to the <a href="/privacy" target="_blank" className="underline">Privacy Policy</a> and consent to being contacted about my message. *</span>
        </label>
        <FieldError id="c-consent-error" message={formState.errors.privacyConsent?.message} />
      </div>
      <button type="submit" disabled={disabled || submitting} className="rounded-full bg-charcoal px-8 py-3 font-semibold text-white hover:bg-black disabled:opacity-50">
        {submitting ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
