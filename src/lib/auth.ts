import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { employees } from "./schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const emp = await db.select().from(employees).where(eq(employees.email, user.email ?? "")).limit(1);
        session.user.isOnboarded = emp.length > 0;
        session.user.isAdmin = emp[0]?.isAdmin ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
