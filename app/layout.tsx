import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Temple Initiative | Say Yes to Vegan Sugar",
    template: "%s · Temple Initiative",
  },
  description:
    "Temple Initiative’s Say Yes to Vegan Sugar campaign helps temple communities check sugar-processing information, make informed choices, and share awareness.",
  openGraph: {
    title: "Temple Initiative | Say Yes to Vegan Sugar",
    description:
      "A public-service message: check how sugar is processed, make an informed choice, and share the message.",
    type: "website",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Temple Initiative — Say Yes to Vegan Sugar" }],
  },
  manifest: "/manifest.webmanifest",
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
