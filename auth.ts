import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { isEmailAllowed } from "@/lib/access-policy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 60 * 60 * 24 * 7 },
  providers: [Google],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ account, profile, user }) {
      return account?.provider === "google" && profile?.email_verified === true &&
        isEmailAllowed(user.email);
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

// Recheck policy on every protected request so removing an email also blocks existing sessions.
export async function currentUser() {
  const session = await auth();
  return session?.user?.id && isEmailAllowed(session.user.email) ? session.user : null;
}
