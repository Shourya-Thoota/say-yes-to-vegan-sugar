"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { donationRequestSchema, type DonationRequestInput } from "@/lib/validation";
import { US_STATES } from "@/lib/us-states";
import { FieldError, inputClassName, labelClassName } from "@/components/ui";

type Props = { disabled?: boolean };

const STEPS = ["Temple", "Contact", "Needs", "Review"] as const;

const INTENDED_USE = [
  { value: "prasadam", label: "Prasadam" },
  { value: "offerings", label: "Religious offerings" },
  { value: "meals", label: "Community meals" },
  { value: "festival", label: "Festival or event" },
  { value: "other", label: "Other" },
] as const;

export function RequestForm({ disabled }: Props) {
  const [step, setStep] = useState(0);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ref: string } | null>(null);
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  );

  const form = useForm<DonationRequestInput>({
    resolver: zodResolver(donationRequestSchema),
    mode: "onBlur",
    defaultValues: {
      company: "",
      idempotencyKey,
      templeName: "",
      templeWebsite: "",
      streetAddress: "",
      addressLine2: "",
      city: "",
      state: "",
      zipCode: "",
      contactName: "",
      contactRole: "",
      contactEmail: "",
      contactPhone: "",
      preferredContact: "email",
      quantityPounds: undefined as unknown as number,
      dateNeeded: "",
      intendedUse: [],
      otherUseExplanation: "",
      currentProduct: "",
      productPreferences: "",
      deliveryInstructions: "",
      additionalNotes: "",
      publicListingConsent: false,
    } as unknown as DonationRequestInput,
  });

  const { register, trigger, getValues, watch, formState } = form;
  const errors = { ...formState.errors, ...serverErrors } as Record<string, { message?: string } | string>;
  const errMsg = (name: string): string | undefined => {
    const e = errors[name];
    if (!e) return undefined;
    return typeof e === "string" ? e : e.message;
  };

  const intendedUse = watch("intendedUse");
  const showOther = useMemo(() => (intendedUse ?? []).includes("other" as never), [intendedUse]);
  const preferred = watch("preferredContact");

  async function next() {
    setServerErrors({});
    const fieldsByStep: Record<number, (keyof DonationRequestInput)[]> = {
      0: ["templeName", "templeWebsite", "streetAddress", "city", "state", "zipCode"],
      1: ["contactName", "contactRole", "contactEmail", "contactPhone", "preferredContact", "authorized"],
      2: ["quantityPounds", "dateNeeded", "intendedUse", "otherUseExplanation"],
      3: ["understandsNoGuarantee", "privacyConsent", "publicListingConsent"],
    };
    const ok = await trigger(fieldsByStep[step] as never);
    if (ok) setStep((s) => Math.min(s + 1, 3));
    else {
      document.getElementById("form-errors")?.focus();
    }
  }

  async function onSubmit(values: DonationRequestInput) {
    setSubmitting(true);
    setServerErrors({});
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, idempotencyKey }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ref?: string;
        errors?: Record<string, string>;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setServerErrors(data.errors ?? { _form: data.message ?? "Submission failed. Your values were preserved — please correct any errors and try again." });
        document.getElementById("form-errors")?.focus();
        return;
      }
      setResult({ ref: data.ref ?? "" });
      window.scrollTo({ top: 0 });
    } catch {
      setServerErrors({ _form: "Network error. Your values were preserved — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-[#E5DCCB] bg-white p-8 text-center" role="status" aria-live="polite">
        <p className="font-heading text-3xl font-bold">Your request has been received.</p>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[#4A4238]">
          Save your reference number. Our team will review your submission and contact you if
          more information is needed.
        </p>
        <p className="mx-auto mt-5 inline-block rounded-xl bg-cream px-6 py-4 font-mono text-2xl font-bold tracking-wide" data-testid="request-reference">
          {result.ref}
        </p>
        <div className="mt-4">
          <CopyButton text={result.ref} />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      aria-label="Sugar donation request form"
      className="rounded-2xl border border-[#E5DCCB] bg-white p-6 sm:p-8"
    >
      {/* Honeypot - hidden from sighted users */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Company
          <input type="text" tabIndex={-1} autoComplete="off" {...register("company")} />
        </label>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="Form progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              i === step ? "bg-charcoal text-white" : i < step ? "bg-terracotta-soft text-terracotta-deeper" : "bg-cream text-[#6B5E4F]"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div id="form-errors" tabIndex={-1} aria-live="assertive" className="outline-none">
        {serverErrors._form && (
          <p role="alert" className="mt-4 rounded-xl border border-[#B3261E] bg-[#FDECEA] p-4 text-[15px] font-medium">
            {serverErrors._form}
          </p>
        )}
        {Object.keys(formState.errors).length > 0 && (
          <p className="mt-4 text-sm font-semibold text-[#9C2B2B]">
            Please correct the highlighted fields below.
          </p>
        )}
      </div>

      {step === 0 && (
        <fieldset className="mt-6 space-y-5">
          <legend className="font-heading text-2xl font-bold">Temple details</legend>
          <div>
            <label htmlFor="templeName" className={labelClassName()}>Temple name *</label>
            <input id="templeName" autoComplete="organization" className={inputClassName(!!errMsg("templeName"))} {...register("templeName")} aria-invalid={!!errMsg("templeName")} aria-describedby={errMsg("templeName") ? "templeName-error" : undefined} />
            <FieldError id="templeName-error" message={errMsg("templeName")} />
          </div>
          <div>
            <label htmlFor="templeWebsite" className={labelClassName()}>Temple website (optional)</label>
            <input id="templeWebsite" inputMode="url" placeholder="https://temple.org" className={inputClassName(!!errMsg("templeWebsite"))} {...register("templeWebsite")} />
            <FieldError id="templeWebsite-error" message={errMsg("templeWebsite")} />
          </div>
          <div>
            <label htmlFor="streetAddress" className={labelClassName()}>Street address *</label>
            <input id="streetAddress" autoComplete="street-address" className={inputClassName(!!errMsg("streetAddress"))} {...register("streetAddress")} />
            <FieldError id="streetAddress-error" message={errMsg("streetAddress")} />
          </div>
          <div>
            <label htmlFor="addressLine2" className={labelClassName()}>Address line 2 (optional)</label>
            <input id="addressLine2" autoComplete="address-line2" className={inputClassName(false)} {...register("addressLine2")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={labelClassName()}>City *</label>
              <input id="city" autoComplete="address-level2" className={inputClassName(!!errMsg("city"))} {...register("city")} />
              <FieldError id="city-error" message={errMsg("city")} />
            </div>
            <div>
              <label htmlFor="state" className={labelClassName()}>State *</label>
              <select id="state" autoComplete="address-level1" className={inputClassName(!!errMsg("state"))} {...register("state")}>
                <option value="">Select a state</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              <FieldError id="state-error" message={errMsg("state")} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="zipCode" className={labelClassName()}>ZIP code *</label>
              <input id="zipCode" autoComplete="postal-code" inputMode="numeric" className={inputClassName(!!errMsg("zipCode"))} {...register("zipCode")} />
              <FieldError id="zipCode-error" message={errMsg("zipCode")} />
            </div>
            <div>
              <span className={labelClassName()}>Country</span>
              <p className="mt-1 rounded-xl border border-[#D8CCB8] bg-cream px-4 py-3">United States</p>
            </div>
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="mt-6 space-y-5">
          <legend className="font-heading text-2xl font-bold">Contact person</legend>
          <div>
            <label htmlFor="contactName" className={labelClassName()}>Full name *</label>
            <input id="contactName" autoComplete="name" className={inputClassName(!!errMsg("contactName"))} {...register("contactName")} />
            <FieldError id="contactName-error" message={errMsg("contactName")} />
          </div>
          <div>
            <label htmlFor="contactRole" className={labelClassName()}>Role at temple *</label>
            <input id="contactRole" placeholder="e.g. Priest, Trustee, Volunteer coordinator" className={inputClassName(!!errMsg("contactRole"))} {...register("contactRole")} />
            <FieldError id="contactRole-error" message={errMsg("contactRole")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contactEmail" className={labelClassName()}>Email *</label>
              <input id="contactEmail" type="email" autoComplete="email" className={inputClassName(!!errMsg("contactEmail"))} {...register("contactEmail")} />
              <FieldError id="contactEmail-error" message={errMsg("contactEmail")} />
            </div>
            <div>
              <label htmlFor="contactPhone" className={labelClassName()}>Phone {preferred === "phone" ? "*" : "(optional)"}</label>
              <input id="contactPhone" type="tel" autoComplete="tel" className={inputClassName(!!errMsg("contactPhone"))} {...register("contactPhone")} />
              <FieldError id="contactPhone-error" message={errMsg("contactPhone")} />
            </div>
          </div>
          <div>
            <span className={labelClassName()} id="pref-label">Preferred contact method *</span>
            <div role="radiogroup" aria-labelledby="pref-label" className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 rounded-xl border border-[#D8CCB8] px-4 py-3">
                <input type="radio" value="email" {...register("preferredContact")} className="h-5 w-5 accent-[#9C4A26]" /> Email
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[#D8CCB8] px-4 py-3">
                <input type="radio" value="phone" {...register("preferredContact")} className="h-5 w-5 accent-[#9C4A26]" /> Phone
              </label>
            </div>
            <FieldError id="preferredContact-error" message={errMsg("preferredContact")} />
          </div>
          <div className="rounded-xl bg-cream p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" {...register("authorized")} className="mt-1 h-5 w-5 accent-[#9C4A26]" />
              <span className="text-[15px] leading-relaxed">
                I confirm that I am authorized to submit this request on behalf of the temple. *
              </span>
            </label>
            <FieldError id="authorized-error" message={errMsg("authorized")} />
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="mt-6 space-y-5">
          <legend className="font-heading text-2xl font-bold">Temple needs</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="quantityPounds" className={labelClassName()}>Requested quantity (pounds) *</label>
              <input id="quantityPounds" type="number" min={1} max={2000} inputMode="numeric" className={inputClassName(!!errMsg("quantityPounds"))} {...register("quantityPounds", { valueAsNumber: true })} />
              <FieldError id="quantityPounds-error" message={errMsg("quantityPounds")} />
            </div>
            <div>
              <label htmlFor="dateNeeded" className={labelClassName()}>Date needed (optional)</label>
              <input id="dateNeeded" type="date" className={inputClassName(!!errMsg("dateNeeded"))} {...register("dateNeeded")} />
              <FieldError id="dateNeeded-error" message={errMsg("dateNeeded")} />
            </div>
          </div>
          <div>
            <span className={labelClassName()} id="use-label">Intended use * (select all that apply)</span>
            <div role="group" aria-labelledby="use-label" className="mt-2 grid gap-2 sm:grid-cols-2">
              {INTENDED_USE.map((u) => (
                <label key={u.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#D8CCB8] px-4 py-3">
                  <input type="checkbox" value={u.value} {...register("intendedUse")} className="h-5 w-5 accent-[#9C4A26]" />
                  <span>{u.label}</span>
                </label>
              ))}
            </div>
            <FieldError id="intendedUse-error" message={errMsg("intendedUse")} />
          </div>
          {showOther && (
            <div>
              <label htmlFor="otherUseExplanation" className={labelClassName()}>Explain the other use *</label>
              <textarea id="otherUseExplanation" rows={3} maxLength={500} className={inputClassName(!!errMsg("otherUseExplanation"))} {...register("otherUseExplanation")} />
              <FieldError id="otherUseExplanation-error" message={errMsg("otherUseExplanation")} />
            </div>
          )}
          <div>
            <label htmlFor="currentProduct" className={labelClassName()}>Current sugar product (optional)</label>
            <input id="currentProduct" maxLength={300} className={inputClassName(false)} {...register("currentProduct")} />
          </div>
          <div>
            <label htmlFor="productPreferences" className={labelClassName()}>Product preferences or requirements (optional)</label>
            <textarea id="productPreferences" rows={3} maxLength={1000} className={inputClassName(false)} {...register("productPreferences")} />
          </div>
          <div>
            <label htmlFor="deliveryInstructions" className={labelClassName()}>Delivery instructions (optional)</label>
            <textarea id="deliveryInstructions" rows={3} maxLength={1000} className={inputClassName(false)} {...register("deliveryInstructions")} />
          </div>
          <div>
            <label htmlFor="additionalNotes" className={labelClassName()}>Additional notes (optional)</label>
            <textarea id="additionalNotes" rows={3} maxLength={2000} className={inputClassName(false)} {...register("additionalNotes")} />
          </div>
        </fieldset>
      )}

      {step === 3 && (
        <div className="mt-6 space-y-5">
          <h2 className="font-heading text-2xl font-bold">Review your request</h2>
          <ReviewSummary getValues={getValues} onEdit={setStep} />
          <div className="space-y-3 rounded-xl bg-cream p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" {...register("understandsNoGuarantee")} className="mt-1 h-5 w-5 accent-[#9C4A26]" />
              <span className="text-[15px] leading-relaxed">I understand that submitting a request does not guarantee approval or delivery. *</span>
            </label>
            <FieldError id="understandsNoGuarantee-error" message={errMsg("understandsNoGuarantee")} />
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" {...register("privacyConsent")} className="mt-1 h-5 w-5 accent-[#9C4A26]" />
              <span className="text-[15px] leading-relaxed">I agree to the <a href="/privacy" target="_blank" className="underline">Privacy Policy</a> and consent to being contacted about this request. *</span>
            </label>
            <FieldError id="privacyConsent-error" message={errMsg("privacyConsent")} />
          </div>
          <div className="rounded-xl border border-[#D8CCB8] bg-white p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" {...register("publicListingConsent")} className="mt-1 h-5 w-5 accent-[#9C4A26]" />
              <span className="text-[15px] leading-relaxed">
                <strong>Optional: List our temple in the public Temple Initiative directory after review.</strong>
              </span>
            </label>
            <ul className="mt-2 list-disc space-y-1 pl-8 text-sm leading-relaxed text-[#4A4238]">
              <li>Opting in is completely optional and does not affect eligibility.</li>
              <li>If approved, only the temple name, city, state, optional website, and a brief participation note are shown publicly.</li>
              <li>Contact name, email, phone number, street address, ZIP code, and private notes are never published.</li>
              <li>You can ask to be removed at any time via the <a href="/contact" className="underline">Contact page</a>.</li>
            </ul>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <div>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="w-full rounded-full border border-[#D8CCB8] bg-white px-6 py-3 font-semibold hover:bg-cream sm:w-auto">
              Back
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {step < 3 ? (
            <button type="button" onClick={next} disabled={disabled} className="rounded-full bg-charcoal px-8 py-3 font-semibold text-white hover:bg-black disabled:opacity-50">
              Continue
            </button>
          ) : (
            <button type="submit" disabled={disabled || submitting} className="rounded-full bg-terracotta-deeper px-8 py-3 font-semibold text-white hover:bg-[#7E3B1E] disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function ReviewSummary({ getValues, onEdit }: { getValues: () => DonationRequestInput; onEdit: (s: number) => void }) {
  const v = getValues();
  const rows: { label: string; value: string; step: number }[] = [
    { label: "Temple", value: `${v.templeName || "—"} · ${v.city || ""}, ${v.state || ""} ${v.zipCode || ""}`, step: 0 },
    { label: "Address", value: `${v.streetAddress || "—"}${v.addressLine2 ? `, ${v.addressLine2}` : ""}`, step: 0 },
    { label: "Website", value: v.templeWebsite || "—", step: 0 },
    { label: "Contact", value: `${v.contactName || "—"} (${v.contactRole || "—"}) · ${v.contactEmail || "—"}`, step: 1 },
    { label: "Quantity", value: v.quantityPounds ? `${v.quantityPounds} lb` : "—", step: 2 },
    { label: "Date needed", value: v.dateNeeded || "Flexible", step: 2 },
    { label: "Intended use", value: (v.intendedUse ?? []).join(", ") || "—", step: 2 },
  ];
  return (
    <dl className="divide-y divide-[#E5DCCB] rounded-xl border border-[#E5DCCB]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
          <div>
            <dt className="text-sm font-semibold uppercase tracking-wide text-[#6B5E4F]">{r.label}</dt>
            <dd className="mt-0.5 break-words">{r.value}</dd>
          </div>
          <button type="button" onClick={() => onEdit(r.step)} className="shrink-0 font-semibold text-terracotta-deeper underline underline-offset-4">
            Edit
          </button>
        </div>
      ))}
    </dl>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch { /* ignore */ }
      }}
      className="rounded-full border border-terracotta-deeper px-5 py-2 font-semibold text-terracotta-deeper"
    >
      {copied ? "Copied" : "Copy reference"}
    </button>
  );
}
