import { ContactForm } from "./contact-form";
import { Eyebrow } from "@/components/ui";
import { isDbConfigured } from "@/lib/db";

export const metadata = { title: "Contact", description: "Contact the Say Yes to Vegan Sugar initiative." };

export default function ContactPage() {
  const dbReady = isDbConfigured();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Contact</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Get in touch.</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#4A4238]">
        Questions about the initiative, your request, or a support offer? Send us a message and
        we will get back to you. Please do not include sensitive personal information beyond
        what the form asks for.
      </p>
      {!dbReady && (
        <div role="alert" className="mt-6 rounded-2xl border border-[#B3261E] bg-[#FDECEA] p-5">
          <strong>Messages are temporarily unavailable.</strong> Please check back later.
        </div>
      )}
      <div className="mt-8"><ContactForm disabled={!dbReady} /></div>
    </div>
  );
}
