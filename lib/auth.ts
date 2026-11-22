import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getServerConfig, isAdminEmail } from "./config";

const cfg = getServerConfig();

const useSecureCookies = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "missing-client-id",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "missing-client-secret",
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  useSecureCookies,
  callbacks: {
    async signIn({ account, profile }) {
      // Require verified email and allowlist membership. Fail closed.
      if (account?.provider !== "google") return false;
      const p = profile as { email?: string; email_verified?: boolean } | null;
      const email = p?.email ?? null;
      if (!email) return false;
      if (p && "email_verified" in p && p.email_verified === false) return false;
      if (!isAdminEmail(email)) return false;
      return true;
    },
    async jwt({ token, profile }) {
      const p = profile as { email?: string } | undefined;
      if (p?.email) token.email = p.email;
      token.isAdmin = isAdminEmail(token.email as string | undefined);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string | undefined) ?? session.user.email;
        (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin === true;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/signin",
    error: "/admin/signin",
  },
});

export async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAdminEmail(email)) return null;
  return { session, email };
}

export function authConfigured(): boolean {
  const c = getServerConfig();
  return Boolean(c.authSecret && c.googleId && c.googleSecret && c.adminEmails.length > 0);
}

void cfg;
