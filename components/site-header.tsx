"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "./brand-mark";

const NAV = [
  { href: "/mission", label: "Our Mission" },
  { href: "/choosing-sugar", label: "Choosing Sugar" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[#E5DCCB] bg-[#F5F0E8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Say Yes to Vegan Sugar home">
          <BrandMark className="h-10 w-10 shrink-0" />
          <span className="leading-tight">
            <span className="block font-heading text-lg font-bold">Say Yes to Vegan Sugar</span>
            <span className="block text-xs text-[#6B5E4F]">A thoughtful choice for every offering.</span>
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[15px] font-medium text-charcoal hover:text-terracotta-deeper hover:underline underline-offset-4">
              {n.label}
            </Link>
          ))}
          <Link href="/support" className="text-[15px] font-medium text-charcoal hover:text-terracotta-deeper hover:underline underline-offset-4">
            Support the Initiative
          </Link>
          <Link
            href="/request-sugar"
            className="rounded-full bg-terracotta-deeper px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm hover:bg-[#7E3B1E]"
          >
            Request Sugar
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#D8CCB8] bg-white md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="border-t border-[#E5DCCB] bg-white px-4 py-4 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {[...NAV, { href: "/support", label: "Support the Initiative" }].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium hover:bg-cream"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/request-sugar"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-terracotta-deeper px-5 py-3 text-center text-base font-semibold text-white"
            >
              Request Sugar
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
