"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";

const NAV = [
  { href: "/#why-check", label: "Why Check Sugar" },
  { href: "/#what-to-look", label: "What to Look For" },
  { href: "/#share", label: "Share the Message" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open ]);
  return (
    <header className="sticky top-0 z-40 border-b border-[#E5DCCB] bg-[#F5F0E8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Temple Initiative home">
          <BrandMark className="h-10 w-10 shrink-0" />
          <span className="leading-tight">
            <span className="block font-heading text-lg font-bold">Temple Initiative</span>
            <span className="block text-xs text-[#6B5E4F]">Say Yes to Vegan Sugar</span>
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[15px] font-medium text-charcoal hover:text-terracotta-deeper hover:underline underline-offset-4">
              {n.label}
            </Link>
          ))}
          <Link href="/contact" className="text-[15px] font-medium text-charcoal hover:text-terracotta-deeper hover:underline underline-offset-4">
            Contact
          </Link>
          <Link
            href="/request-sugar"
            className="min-h-[44px] rounded-xl border border-terracotta-deeper bg-transparent px-5 py-2.5 text-[15px] font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
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
            {[...NAV, { href: "/support", label: "Support" }, { href: "/contact", label: "Contact" }].map((n) => (
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
              className="mt-2 min-h-[44px] rounded-xl border border-terracotta-deeper px-5 py-3 text-center text-base font-semibold text-terracotta-deeper"
            >
              Request Sugar for Your Temple
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
