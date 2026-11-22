import { SupportForm } from "./support-form";
import { Eyebrow } from "@/components/ui";
import { isDbConfigured } from "@/lib/db";

export const metadata = { title: "Support the Initiative", description: "Offer suitable sugar, coordination help, or introductions." };

export default function SupportPage() {
  const dbReady = isDbConfigured();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Support</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Help support temple communities.</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#4A4238]">
        Interested in donating suitable sugar, helping coordinate deliveries, or introducing the
        initiative to your temple? Tell us how you would like to help.
      </p>
      <div role="note" className="mt-6 rounded-2xl border border-[#D8A679] bg-[#FFF8EF] p-5 text-[15px] leading-relaxed">
        <strong>Please contact us before purchasing or shipping sugar.</strong> Product suitability,
        quantities, and delivery arrangements must be confirmed in advance.
      </div>
      {!dbReady && (
        <div role="alert" className="mt-6 rounded-2xl border border-[#B3261E] bg-[#FDECEA] p-5">
          <strong>Support offers are temporarily unavailable.</strong> Please check back later.
        </div>
      )}
      <div className="mt-8"><SupportForm disabled={!dbReady} /></div>
    </div>
  );
}
