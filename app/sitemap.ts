import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const pages = ["/", "/mission", "/choosing-sugar", "/poster", "/how-it-works", "/request-sugar", "/support", "/faq", "/contact", "/privacy", "/terms"];
  return pages.map((p) => ({ url: `${base}${p}`, lastModified: new Date(), changeFrequency: "monthly", priority: p === "/" ? 1 : 0.7 }));
}
