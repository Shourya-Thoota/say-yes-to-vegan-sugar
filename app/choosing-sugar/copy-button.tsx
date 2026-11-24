"use client";

import { useState } from "react";

export function CopyInquiryButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("copied");
          } catch {
            setStatus("error");
          }
          window.setTimeout(() => setStatus("idle"), 3000);
        }}
        className="min-h-[44px] rounded-xl bg-charcoal px-6 py-2.5 font-semibold text-white hover:bg-black"
        aria-live="polite"
      >
        {status === "copied" ? "Copied to clipboard" : "Copy Inquiry"}
      </button>
      <span role="status" aria-live="polite" className="ml-3 text-sm font-medium text-terracotta-deeper">
        {status === "copied" ? "Inquiry text copied. Paste it into your message to the manufacturer." : ""}
        {status === "error" ? "Copy failed. Please select and copy the text manually." : ""}
      </span>
    </div>
  );
}
