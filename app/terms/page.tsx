import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Terms", description: "Terms for using the Say Yes to Vegan Sugar website." };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Terms</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold">Terms (draft)</h1>
      <p className="mt-2 text-sm text-[#6B5E4F]">Plain-language draft. Operator and legal details are still being finalized.</p>
      <div className="mt-6 space-y-6 leading-relaxed text-[#3E372E]">
        <section><h2 className="font-heading text-xl font-bold">What this site is</h2>
          <p className="mt-2">Say Yes to Vegan Sugar is an independent community initiative website. It provides educational information and accepts donation requests, support offers, and contact messages. It is not an online store.</p></section>
        <section><h2 className="font-heading text-xl font-bold">No guarantees</h2>
          <p className="mt-2">Submitting a request does not guarantee approval or delivery. Fulfillment depends on review, available resources, and confirmed delivery arrangements. Do not rely on a donation before written approval and coordination.</p></section>
        <section><h2 className="font-heading text-xl font-bold">No tax claims</h2>
          <p className="mt-2">Nothing on this site claims nonprofit registration or tax-deductible status for any contribution. Do not treat participation as a tax-deductible donation.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Accurate submissions</h2>
          <p className="mt-2">By submitting a form, you confirm that you are authorized to share the information provided, that it is accurate to the best of your knowledge, and that you consent to being contacted about your submission.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Educational content</h2>
          <p className="mt-2">Sugar-selection guidance supports purchasing decisions; it does not certify products. Product information may change. Always verify the specific product with the manufacturer.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Acceptable use</h2>
          <p className="mt-2">Do not submit false information, attempt to access the administrator dashboard without authorization, or interfere with the service. Misuse may result in requests being declined and access being restricted.</p></section>
      </div>
    </div>
  );
}
