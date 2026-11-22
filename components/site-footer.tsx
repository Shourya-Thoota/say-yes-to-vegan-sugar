import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#E5DCCB] bg-[#EFE7D8]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <p className="font-heading text-lg font-bold">Say Yes to Vegan Sugar</p>
          </div>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#5A4F42]">
            An independent community initiative. Temple participation and donation fulfillment are subject to confirmation.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#6B5E4F]">Explore</p>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><Link className="hover:underline" href="/mission">Our Mission</Link></li>
            <li><Link className="hover:underline" href="/choosing-sugar">Choosing Sugar</Link></li>
            <li><Link className="hover:underline" href="/how-it-works">How It Works</Link></li>
            <li><Link className="hover:underline" href="/request-sugar">Request Sugar</Link></li>
            <li><Link className="hover:underline" href="/support">Support the Initiative</Link></li>
            <li><Link className="hover:underline" href="/faq">FAQ</Link></li>
            <li><Link className="hover:underline" href="/contact">Contact</Link></li>
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#6B5E4F]">About</p>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><Link className="hover:underline" href="/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:underline" href="/terms">Terms</Link></li>
            <li><Link className="hover:underline" href="/contact">Contact</Link></li>
          </ul>
          <p className="mt-4 text-sm text-[#6B5E4F]">© {year} Say Yes to Vegan Sugar.</p>
        </div>
      </div>
    </footer>
  );
}
