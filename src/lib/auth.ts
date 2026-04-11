import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "partner-login",
      name: "Partner Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        partnerCode: { label: "Partner Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        const partnerCode = credentials?.partnerCode as string;

        if (!email) return null;

        try {
          // Find partner by email
          const partner = await prisma.partner.findFirst({
            where: { email },
          });

          if (partner) {
            if (partner.status === "blocked") return null;

            // If partner has a password, authenticate with email + password
            if (partner.passwordHash && password) {
              const valid = await compare(password, partner.passwordHash);
              if (!valid) return null;
            } else if (partnerCode) {
              // Legacy: authenticate with email + partner code
              if (partner.partnerCode !== partnerCode.toUpperCase()) return null;
            } else {
              return null;
            }

            return {
              id: partner.id,
              email: partner.email,
              name: `${partner.firstName} ${partner.lastName}`,
              role: "partner",
              partnerCode: partner.partnerCode,
            };
          }
        } catch {
          // DB may not be ready yet
        }

        // Demo mode fallback
        if (partnerCode) {
          return {
            id: "demo",
            email,
            name: "Demo Partner",
            role: "partner",
            partnerCode,
          };
        }

        return null;
      },
    }),
    Credentials({
      id: "admin-login",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (!email || !password) return null;

        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (user) {
            const valid = await compare(password, user.passwordHash);
            if (!valid) return null;
            return {
              id: user.id,
              email: user.email,
              name: user.name || user.email,
              role: user.role,
            };
          }
        } catch {
          // Table may not exist yet
        }

        // Demo mode
        const isDemo = !process.env.HUBSPOT_PRIVATE_TOKEN || process.env.HUBSPOT_PRIVATE_TOKEN === "YOUR_PRIVATE_APP_TOKEN";
        if (isDemo) {
          return {
            id: "demo-admin",
            email,
            name: "Admin User",
            role: "admin",
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.partnerCode = (user as any).partnerCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).partnerCode = token.partnerCode;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
