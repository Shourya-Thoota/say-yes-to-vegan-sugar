"use client";

import { useState } from "react";
import { buildShareData, buildShareText, getSiteUrl } from "@/lib/share";

export function ShareSection() {
  const [status, setStatus] = useState<string>("");
  const [failed, setFailed] = useState(false);

  async function copyText(text: string, okMessage: string) {
    try {
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
    const data = buildShareData(siteUrl);
    try {
      if (navigator.share) {
        await navigator.share(data);
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
  const message = siteUrl ? buildShareText(siteUrl) : "";

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={handleNativeShare}
            className="rounded-full bg-terracotta-deeper px-7 py-3.5 text-center text-base font-semibold text-white shadow-sm hover:bg-[#7E3B1E]"
          >
            Share This Message
          </button>
          <button
            type="button"
            onClick={() => copyText(getSiteUrl() + "/", "Link copied. Paste it into a message to your temple community.")}
            className="rounded-full border border-terracotta-deeper bg-white px-7 py-3.5 text-center text-base font-semibold text-terracotta-deeper hover:bg-terracotta-soft"
          >
            Copy Link
          </button>
          <button
            type="button"
            onClick={() => copyText(buildShareText(getSiteUrl()), "Message copied. Paste it into email, text, or a community group.")}
            className="rounded-full border border-[#D8CCB8] bg-white px-7 py-3.5 text-center text-base font-semibold text-charcoal hover:bg-[#EFE7D8]"
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
      </div>
      <div className="rounded-2xl border border-[#E5DCCB] bg-white p-6">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#6B5E4F]">Suggested message</p>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#4A4238]">
          {message || "Loading share message…"}
        </p>
      </div>
    </div>
  );
}
