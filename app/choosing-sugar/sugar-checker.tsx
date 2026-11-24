"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  SUGAR_CATEGORIES,
  getCheckerResult,
  type SugarCategoryId,
} from "@/lib/sugar-checker";

type NextAction = "documentation" | "inquiry" | "print" | null;

export function SugarChecker() {
  const groupId = useId();
  const [selected, setSelected] = useState<SugarCategoryId | null>(null);
  const [nextAction, setNextAction] = useState<NextAction>(null);

  const result = selected ? getCheckerResult(selected) : null;

  function resetAll() {
    setSelected(null);
    setNextAction(null);
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#D8CCB8] bg-white p-6 sm:p-8">
      <fieldset>
        <legend className="font-heading text-xl font-bold">
          Step 1 — Which best describes your sugar?
        </legend>
        <p className="mt-1 text-[15px] text-[#6B5E4F]">
          Choose one. This tool gives guidance only; it does not certify any product.
        </p>
        <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Sugar category">
          {SUGAR_CATEGORIES.map((c) => (
            <label
              key={c.id}
              className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 leading-relaxed transition-colors ${
                selected === c.id
                  ? "border-terracotta-deeper bg-terracotta-soft"
                  : "border-[#E5DCCB] hover:border-terracotta-deeper"
              }`}
            >
              <input
                type="radio"
                name={`sugar-category-${groupId}`}
                value={c.id}
                checked={selected === c.id}
                onChange={() => {
                  setSelected(c.id);
                  setNextAction(null);
                }}
                className="mt-1 h-5 w-5 shrink-0 accent-[#9C4A26]"
              />
              <span>
                <span className="block font-semibold">{c.label}</span>
                <span className="block text-sm text-[#6B5E4F]">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {result ? (
        <div aria-live="polite" className="mt-6 border-t border-[#E5DCCB] pt-6">
          <h3 className="font-heading text-xl font-bold">{result.heading}</h3>
          <p className="mt-2 leading-relaxed text-[#4A4238]">{result.explanation}</p>

          <h4 className="mt-5 font-heading text-lg font-bold">
            Step 2 — What to look for on this product
          </h4>
          <ul className="mt-2 list-disc space-y-2 pl-6 leading-relaxed text-[#4A4238]">
            {result.verify.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>

          <p className="mt-4 rounded-xl bg-[#F5F0E8] p-4 text-[15px] leading-relaxed text-[#4A4238]">
            <strong>Limitation: </strong>
            {result.limitation}
          </p>

          <p className="mt-3 text-sm">
            Sources:{" "}
            {result.sources.map((s, i) => (
              <span key={s.href}>
                {i > 0 ? "; " : ""}
                <a
                  className="source-link"
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.label}
                </a>
              </span>
            ))}
          </p>

          <fieldset className="mt-6">
            <legend className="font-heading text-lg font-bold">
              Step 3 — Choose your next step
            </legend>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => setNextAction("documentation")}
                aria-pressed={nextAction === "documentation"}
                className={`min-h-[44px] rounded-xl px-6 py-3 text-center font-semibold ${
                  nextAction === "documentation"
                    ? "bg-charcoal text-white"
                    : "border border-charcoal bg-white text-charcoal hover:bg-[#EFE7D8]"
                }`}
              >
                Review the checklist
              </button>
              <button
                type="button"
                onClick={() => setNextAction("inquiry")}
                aria-pressed={nextAction === "inquiry"}
                className={`min-h-[44px] rounded-xl px-6 py-3 text-center font-semibold ${
                  nextAction === "inquiry"
                    ? "bg-charcoal text-white"
                    : "border border-charcoal bg-white text-charcoal hover:bg-[#EFE7D8]"
                }`}
              >
                Draft an inquiry
              </button>
              <Link
                href="/poster"
                onClick={() => setNextAction("print")}
                className={`inline-block min-h-[44px] rounded-xl px-6 py-3 text-center font-semibold ${
                  nextAction === "print"
                    ? "bg-charcoal text-white"
                    : "border border-charcoal bg-white text-charcoal hover:bg-[#EFE7D8]"
                }`}
              >
                Print the kitchen guide
              </Link>
            </div>
          </fieldset>

          {nextAction === "documentation" ? (
            <p className="mt-4 leading-relaxed">
              Use the product-checking checklist further down this page, and keep the
              written response with the date you checked.{" "}
              <a href="#checklist" className="font-semibold text-terracotta-deeper underline underline-offset-4">
                Jump to the checklist
              </a>
              .
            </p>
          ) : null}
          {nextAction === "inquiry" ? (
            <p className="mt-4 leading-relaxed">
              Fill in the manufacturer inquiry below and keep the maker&apos;s written
              reply with your purchasing records.{" "}
              <a href="#inquiry" className="font-semibold text-terracotta-deeper underline underline-offset-4">
                Jump to the inquiry builder
              </a>
              .
            </p>
          ) : null}
          {nextAction === "print" ? (
            <p className="mt-4 leading-relaxed">
              The one-page kitchen guide prints on US Letter and A4 with write-in lines
              for your purchasing records.
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="min-h-[44px] rounded-xl border border-[#D8CCB8] bg-white px-6 py-2.5 font-semibold text-charcoal hover:bg-[#EFE7D8]"
            >
              Back to categories
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="min-h-[44px] rounded-xl border border-[#D8CCB8] bg-white px-6 py-2.5 font-semibold text-charcoal hover:bg-[#EFE7D8]"
            >
              Start over
            </button>
          </div>
          <p className="mt-3 text-sm text-[#6B5E4F]">
            If the evidence is incomplete, treat this as a “confirm with the
            manufacturer” case. Nothing here certifies a product.
          </p>
        </div>
      ) : (
        <p className="mt-6 border-t border-[#E5DCCB] pt-6 leading-relaxed text-[#6B5E4F]">
          Select a category above to see what to check, what the limits are, and what
          to do next.
        </p>
      )}
    </div>
  );
}
