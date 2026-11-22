import { signIn } from "@/lib/auth";

export const metadata = { title: "Administrator Sign In", robots: { index: false, follow: false } };

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const err = (await searchParams)?.error;
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Administrator sign in</h1>
      <p className="mt-3 leading-relaxed text-[#4A4238]">
        Restricted area. Sign in with Google using an authorized administrator email.
      </p>
      {err && (
        <p role="alert" className="mt-4 rounded-xl border border-[#B3261E] bg-[#FDECEA] p-4 font-medium">
          {err === "AccessDenied"
            ? "Access denied. This Google account is not on the administrator allowlist."
            : "Sign-in failed. Please try again."}
        </p>
      )}
      <form
        className="mt-6 rounded-2xl border border-[#E5DCCB] bg-white p-6"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/admin" });
        }}
      >
        <button type="submit" className="w-full rounded-full bg-charcoal px-6 py-3 font-semibold text-white hover:bg-black">
          Continue with Google
        </button>
      </form>
    </div>
  );
}
