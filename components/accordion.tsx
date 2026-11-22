"use client";

import { useState } from "react";

export type FaqItem = { q: string; a: string };

export function Accordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-[#E5DCCB] rounded-2xl border border-[#E5DCCB] bg-white">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-button-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-heading text-lg font-bold hover:bg-cream/60"
              >
                <span>{item.q}</span>
                <span aria-hidden="true" className="text-terracotta-deeper text-2xl leading-none">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            {isOpen && (
              <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-button-${i}`} className="px-5 pb-5 text-[16px] leading-relaxed text-[#4A4238]">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
