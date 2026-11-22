import { RequestForm } from "./request-form";
import { Eyebrow } from "@/components/ui";
import { isDbConfigured } from "@/lib/db";

export const metadata = {
  title: "Request Sugar",
  description: "Submit a sugar donation request for your Hindu temple.",
};

export default function RequestSugarPage() {
  const dbReady = isDbConfigured();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Request a sugar donation</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Tell us what your temple needs.</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#4A4238]">
        Requests are reviewed individually. Submitting a request does not guarantee approval or
        delivery. This program is for Hindu temples in the United States, not individual
        household requests.
      </p>
      {!dbReady && (
        <div role="alert" className="mt-6 rounded-2xl border border-[#B3261E] bg-[#FDECEA] p-5">
          <strong>Requests are temporarily unavailable.</strong> Our submission system is not
          configured yet. Please check back later or use the contact form for questions. No
          information you enter here will be saved while the system is unavailable.
        </div>
      )}
      <div className="mt-8">
        <RequestForm disabled={!dbReady} />
      </div>
    </div>
  );
}
