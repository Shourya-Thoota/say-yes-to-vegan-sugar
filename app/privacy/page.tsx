import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Privacy Policy", description: "How Say Yes to Vegan Sugar handles information you share." };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Eyebrow>Privacy policy</Eyebrow>
      <h1 className="mt-2 text-4xl font-bold">Privacy Policy (draft)</h1>
      <p className="mt-2 text-sm text-[#6B5E4F]">Policy version v1. This is a plain-language draft matching the current implementation. Operator details are still being finalized — see the launch checklist in the README.</p>
      <div className="mt-6 space-y-6 leading-relaxed text-[#3E372E]">
        <section><h2 className="font-heading text-xl font-bold">Information collected</h2>
          <p className="mt-2">When you submit a form, we collect only what the form asks for: temple details and contact information on donation requests; name, email, and your message on support offers and contact inquiries; plus consent confirmations and a policy version. We also record technical submission metadata such as timestamps and rate-limit counters needed to operate the service securely.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Purpose</h2>
          <p className="mt-2">We use this information to review requests, respond to messages, coordinate confirmed deliveries, and protect the service from misuse. We do not sell personal information and do not use it for advertising.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Administrator access</h2>
          <p className="mt-2">A small set of authorized administrators can view submissions through a protected dashboard to review requests and respond to inquiries. Access requires Google sign-in with an email on the administrator allowlist.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Sharing</h2>
          <p className="mt-2">We share information only as needed to operate the service: hosting and database providers that store the data, authentication providers that verify administrator sign-in, an error-monitoring provider that receives diagnostic information about unexpected errors (see “Error monitoring” below), and — only for confirmed delivery coordination — the delivery parties a temple approves. We do not publish personal data or expose a public request-lookup page.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Error monitoring</h2>
          <p className="mt-2">We use Sentry for operational error monitoring so we can identify broken donation submissions, website errors, and administration failures. When an unexpected error occurs, diagnostic information (such as the page or operation involved and technical error details) is sent to Sentry. The integration is configured to minimize personal information: session replay and user identification are not enabled, and form contents, cookies, authentication material, and database contents are stripped before transmission. Some technical details may still be transmitted as part of an error report; review the README&apos;s error-monitoring section for the current safeguards. Account-side settings (such as data retention) are controlled in the Sentry dashboard by the operator.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Your choices</h2>
          <p className="mt-2">To access, correct, or request deletion of information you submitted, contact us through the contact form and include your submission reference number if you have one. We will respond to reasonable requests consistent with record-keeping needs for pending or fulfilled requests.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Security and retention</h2>
          <p className="mt-2">Submissions travel over HTTPS and are stored in a managed PostgreSQL database with authenticated admin access, server-side validation, and rate limiting. Retention periods and backup arrangements are still being finalized by the operator; do not treat this draft as imposing specific retention timelines.</p></section>
        <section><h2 className="font-heading text-xl font-bold">Changes</h2>
          <p className="mt-2">If this policy changes materially, the policy version recorded with new submissions will be updated. Continued use of the forms after an update constitutes agreement to the updated policy.</p></section>
      </div>
    </div>
  );
}
