"use client";

export function PrintButton() {
  return (
    <div className="no-print mt-6 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="min-h-[44px] rounded-xl bg-charcoal px-6 py-3 font-semibold text-white hover:bg-black"
      >
        Print / Save as PDF
      </button>
      <p className="text-sm text-[#6B5E4F]">
        Opens your browser&apos;s print dialog. No file is downloaded automatically — choose
        &ldquo;Save as PDF&rdquo; in the dialog to keep a copy.
      </p>
    </div>
  );
}
