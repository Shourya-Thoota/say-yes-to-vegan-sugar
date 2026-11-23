import { RequestForm } from "./request-form";
import { Eyebrow } from "@/components/ui";
import { isDbConfigured } from "@/lib/db";

export const metadata = {
  title: "Request Sugar",
  description: "Authorized temple representatives may request donation support for consideration. Reviewed individually; not guaranteed.",
};

export default function RequestSugarPage() {
  const dbReady = isDbConfigured();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Temple support · secondary to awareness</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Request sugar for your temple.</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#4A4238]">
        Temple Initiative’s current campaign focuses on vegan-sugar awareness. This form lets
        authorized temple representatives request donation support when resources are available.
        Requests are reviewed individually. Donations and delivery are not guaranteed.
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
