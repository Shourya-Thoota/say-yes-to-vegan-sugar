"use client";

import { useState } from "react";
import {
  PUBLISHED_SHARE_LANGUAGES,
  buildShareData,
  buildShareText,
  getShareMessageForLanguage,
  getSiteUrl,
} from "@/lib/share";

export function ShareSection() {
  const [status, setStatus] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [language, setLanguage] = useState<string>("en");

  async function copyText(text: string, okMessage: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus(okMessage);
      setFailed(false);
    } catch {
      setStatus("Copy did not work in this browser. Please select and copy the link manually.");
      setFailed(true);
    }
  }

  async function handleNativeShare() {
    const siteUrl = getSiteUrl();
    const message = getShareMessageForLanguage(language);
    const data = buildShareData(siteUrl);
    try {
      if (navigator.share) {
        await navigator.share({ ...data, text: message });
        setStatus("Thanks for helping spread the message.");
        setFailed(false);
      } else {
        await copyText(data.url, "Link copied. Paste it into a message to your temple community.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("");
        setFailed(false);
        return;
      }
      await copyText(data.url, "Link copied. Paste it into a message to your temple community.");
    }
  }

  const siteUrl = typeof window !== "undefined" ? getSiteUrl() : "";
  const message = siteUrl ? buildShareText(siteUrl, language) : "";
  const selectedLang = PUBLISHED_SHARE_LANGUAGES.find((l) => l.code === language);

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
      <div>
        <div>
          <label htmlFor="share-language" className="block text-[15px] font-semibold text-charcoal">
            Message language
          </label>
          <select
            id="share-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            lang={selectedLang?.code ?? "en"}
            className="mt-1 block w-full max-w-xs rounded-xl border border-[#D8CCB8] bg-white px-4 py-3 text-base text-charcoal focus:border-terracotta-deeper focus:outline-none"
          >
            {PUBLISHED_SHARE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.nativeLabel} ({l.label})
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-[#6B5E4F]">
            English is published today. Additional community languages are in review —
            see our translation notes before sharing other versions.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={handleNativeShare}
            className="min-h-[44px] rounded-xl bg-terracotta-deeper px-7 py-3.5 text-center text-base font-semibold text-white shadow-sm hover:bg-[#7E3B1E]"
          >
            Share This Message
          </button>
          <button
            type="button"
            onClick={() => copyText(getSiteUrl() + "/", "Link copied. Paste it into a message to your temple community.")}
            className="min-h-[44px] rounded-xl border border-terracotta-deeper bg-white px-7 py-3.5 text-center text-base font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
          >
            Copy Link
          </button>
          <button
            type="button"
            onClick={() => copyText(buildShareText(getSiteUrl(), language), "Message copied. Paste it into email, text, or a community group.")}
            className="min-h-[44px] rounded-xl border border-[#D8CCB8] bg-white px-7 py-3.5 text-center text-base font-semibold text-charcoal hover:bg-[#EFE7D8]"
          >
            Copy Message
          </button>
        </div>
        <p role="status" aria-live="polite" className={`mt-4 text-[15px] font-medium ${failed ? "text-[#9C2B2B]" : "text-terracotta-deeper"}`}>
          {status}
        </p>
        <p className="mt-2 text-sm text-[#6B5E4F]">
          No contacts are accessed and nothing is sent automatically. You choose where to share.
        </p>
        <noscript>
          <p className="mt-3 text-[15px] leading-relaxed">
            Share this page: https://say-yes-to-vegan-sugar-production.up.railway.app/
          </p>
        </noscript>
      </div>
      <div className="rounded-2xl border border-[#E5DCCB] bg-white p-6">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#6B5E4F]">Suggested message</p>
        <p lang={language} className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-[#4A4238]">
          {message || "Loading share message…"}
        </p>
      </div>
    </div>
  );
}
