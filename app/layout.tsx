import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Say Yes to Vegan Sugar — A thoughtful choice for every offering",
    template: "%s · Say Yes to Vegan Sugar",
  },
  description:
    "An independent community initiative helping Hindu temples in the United States make informed sugar choices and request donated vegan sugar.",
  openGraph: {
    title: "Say Yes to Vegan Sugar",
    description: "A thoughtful choice for every offering.",
    type: "website",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Say Yes to Vegan Sugar" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-body antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
