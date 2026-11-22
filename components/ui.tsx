import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#E5DCCB] bg-white p-6 shadow-[0_1px_2px_rgba(45,45,45,0.06)] ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-terracotta-deeper">{children}</p>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-[#9C2B2B]">
      {message}
    </p>
  );
}

export function inputClassName(hasError: boolean) {
  return `mt-1 block w-full rounded-xl border bg-white px-4 py-3 text-base text-charcoal placeholder:text-[#9A8F7F] focus:border-terracotta-deeper focus:outline-none ${
    hasError ? "border-[#B3261E]" : "border-[#D8CCB8]"
  }`;
}

export function labelClassName() {
  return "block text-[15px] font-semibold text-charcoal";
}
