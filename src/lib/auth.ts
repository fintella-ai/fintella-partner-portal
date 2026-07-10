import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { verifyTotpCode } from "./totp";

/**
 * Google sign-in is **partner-only** and strictly a convenience shortcut for
 * already-invited partners. We do NOT auto-provision new partners from a
 * Google account (the portal is invite-only per the business rule — see
 * feedback_partners_invite_only). The signIn callback below rejects any
 * Google login whose email doesn't match an existing Partner row.
 *
 * Env vars (set on Vercel for prod + any preview you want to test against):
 *   AUTH_GOOGLE_ID      — Google OAuth 2.0 Web client ID
 *   AUTH_GOOGLE_SECRET  — Google OAuth 2.0 Web client secret
 * NextAuth v5 auto-picks these up when the provider has no explicit
 * clientId/clientSecret.
 *
 * Redirect URI to register in Google Cloud Console:
 *   https://fintella.partners/api/auth/callback/google
 */

// OpCenter (opcenter.app) embeds this portal's /login in a cross-site
// iframe. The default SameSite=Lax session/csrf/callback cookies never reach
// the browser on requests made from inside that iframe (SameSite is
// evaluated against the top-level site, i.e. opcenter.app, not the immediate
// frame) — login appeared to just reload the login page because the POST
// succeeded but the follow-up request had no session cookie attached.
// SameSite=None (+ Secure, required, and Partitioned/CHIPS so the cookie
// isn't treated as third-party tracking) fixes cross-site delivery. Only
// applied when secure cookies are in play (prod/preview HTTPS) — local
// `next dev` over http can't set Secure cookies at all, so leave dev on the
// unmodified Lax defaults.
const useSecureCookies = process.env.NODE_ENV === "production";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  ...(useSecureCookies && {
    cookies: {
      sessionToken: {
        name: "__Secure-authjs.session-token",
        options: { httpOnly: true, sameSite: "none", path: "/", secure: true, partitioned: true },
      },
      callbackUrl: {
        name: "__Secure-authjs.callback-url",
        options: { sameSite: "none", path: "/", secure: true, partitioned: true },
      },
      csrfToken: {
        name: "__Host-authjs.csrf-token",
        options: { httpOnly: true, sameSite: "none", path: "/", secure: true, partitioned: true },
      },
    },
  }),
  providers: [
    Google,
    Credentials({
      id: "partner-login",
      name: "Partner Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        const totp = ((credentials?.totp as string) || "").trim();

        if (!email || !password) return null;

        // Check PartnerUser first (corporate multi-login)
        const partnerUser = await prisma.partnerUser.findFirst({
          where: { email: { equals: email.trim(), mode: "insensitive" }, active: true },
        });
        if (partnerUser) {
          const partner = await prisma.partner.findFirst({
            where: { partnerCode: partnerUser.partnerCode },
          });
          if (!partner) return null;
          if (partner.status === "blocked" || partner.status === "archived") return null;

          const valid = await compare(password, partnerUser.passwordHash);
          if (!valid) return null;

          // MFA gate — only challenges identities that have enrolled. Google
          // sign-ins never reach this provider, so they're inherently exempt.
          if (partnerUser.totpEnabled && partnerUser.totpSecret) {
            const res = await verifyTotpCode(partnerUser, totp);
            if (!res.ok) return null;
            if (res.consumedBackupCodes !== null) {
              await prisma.partnerUser.update({
                where: { id: partnerUser.id },
                data: { totpBackupCodes: res.consumedBackupCodes },
              });
            }
          }

          return {
            id: partner.id,
            email: partnerUser.email,
            name: `${partnerUser.firstName} ${partnerUser.lastName}`,
            role: "partner",
            partnerCode: partner.partnerCode,
            partnerType: partner.partnerType || "referral",
            authProvider: "credentials-partner",
          };
        }

        // Fall back to direct Partner login
        const partner = await prisma.partner.findFirst({
          where: { email: { equals: email.trim(), mode: "insensitive" } },
        });

        if (!partner) return null;
        if (partner.status === "blocked") return null;
        if (partner.status === "archived") return null;
        if (!partner.passwordHash) return null;

        const valid = await compare(password, partner.passwordHash);
        if (!valid) return null;

        // MFA gate — only enrolled partners are challenged. Google is exempt.
        if (partner.totpEnabled && partner.totpSecret) {
          const res = await verifyTotpCode(partner, totp);
          if (!res.ok) return null;
          if (res.consumedBackupCodes !== null) {
            await prisma.partner.update({
              where: { id: partner.id },
              data: { totpBackupCodes: res.consumedBackupCodes },
            });
          }
        }

        return {
          id: partner.id,
          email: partner.email,
          name: `${partner.firstName} ${partner.lastName}`,
          role: "partner",
          partnerCode: partner.partnerCode,
          partnerType: partner.partnerType || "referral",
          authProvider: "credentials-partner",
        };
      },
    }),
    Credentials({
      id: "impersonate-login",
      name: "Impersonate Partner",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token as string;
        if (!token) return null;

        const record = await prisma.impersonationToken.findUnique({ where: { token } });
        if (!record) return null;
        if (record.used) return null;
        if (new Date() > record.expiresAt) return null;

        const partner = await prisma.partner.findUnique({
          where: { partnerCode: record.partnerCode },
        });
        if (!partner) return null;
        if (partner.status === "blocked") return null;
        if (partner.status === "archived") return null;

        await prisma.impersonationToken.update({
          where: { token },
          data: { used: true },
        });

        return {
          id: partner.id,
          email: partner.email,
          name: `${partner.firstName} ${partner.lastName}`,
          role: "partner",
          partnerCode: partner.partnerCode,
          partnerType: partner.partnerType || "referral",
          authProvider: "impersonate",
        };
      },
    }),
    Credentials({
      id: "admin-login",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        const totp = ((credentials?.totp as string) || "").trim();

        if (!email || !password) return null;

        // Case-insensitive lookup — same reasoning as the partner provider.
        const user = await prisma.user.findFirst({
          where: { email: { equals: email.trim(), mode: "insensitive" } },
        });
        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        // Opt-in 2FA gate. Admins without totpEnabled log in exactly as before
        // (no code required, no lockout). Only enrolled admins are challenged.
        if (user.totpEnabled && user.totpSecret) {
          const res = await verifyTotpCode(user, totp);
          if (!res.ok) return null;
          if (res.consumedBackupCodes !== null) {
            await prisma.user.update({
              where: { id: user.id },
              data: { totpBackupCodes: res.consumedBackupCodes },
            });
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          role: user.role,
          authProvider: "credentials-admin",
        };
      },
    }),
  ],
  callbacks: {
    // Gate Google sign-ins to invited partners only. Non-partner emails and
    // blocked partners are bounced back to /login with a human-readable
    // error query string that the login page renders inline.
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.trim();
      if (!email) return "/login?error=google-no-email";
      // Check direct partner first
      const partner = await prisma.partner.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (partner) {
        if (partner.status === "blocked") return "/login?error=blocked";
        if (partner.status === "archived") return "/login?error=archived";
        return true;
      }
      // Check PartnerUser (corporate team member)
      const partnerUser = await prisma.partnerUser.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, active: true },
      });
      if (partnerUser) {
        const ownerPartner = await prisma.partner.findFirst({ where: { partnerCode: partnerUser.partnerCode } });
        if (ownerPartner?.status === "blocked") return "/login?error=blocked";
        if (ownerPartner?.status === "archived") return "/login?error=archived";
        return true;
      }
      // Finally, allow Google sign-in for admins (a matching User row). Google
      // OAuth is itself the strong factor, so admins authenticated this way
      // bypass the TOTP gate — that's the intended "Google OR TOTP" model.
      const adminUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (adminUser) return true;
      return "/login?error=not-invited";
    },
    async jwt({ token, user, account }) {
      // Credentials providers set user.role / user.partnerCode directly.
      if (user) {
        token.role = (user as any).role ?? token.role;
        token.partnerCode = (user as any).partnerCode ?? token.partnerCode;
        token.partnerType = (user as any).partnerType ?? token.partnerType;
        token.authProvider = (user as any).authProvider ?? token.authProvider;
        // Audit log: sign-in event (fire-and-forget)
        import("@/lib/audit-log").then(({ logAudit }) =>
          logAudit({
            action: "sign_in",
            actorEmail: (user.email || token.email || "unknown") as string,
            actorRole: ((user as any).role || token.role || "unknown") as string,
            actorId: (user as any).partnerCode || user.id || null,
            details: { provider: account?.provider || "credentials" },
          })
        ).catch(() => {});
        // Engagement: track portal login for partners
        if ((user as any).partnerCode) {
          import("@/lib/engagement").then(({ recordActivity }) =>
            recordActivity((user as any).partnerCode, "portal_login")
          ).catch(() => {});
        }
      }
      // Google is the strong second factor — flag it so the MFA enrollment gate
      // never challenges a Google-authenticated user (the intended exemption).
      if (account?.provider === "google") token.authProvider = "google";
      // Google sign-ins don't populate those fields — hydrate from the
      // Partner row (or PartnerUser) keyed by email on the first JWT pass.
      if (account?.provider === "google" && token.email && !token.partnerCode) {
        const partner = await prisma.partner.findFirst({
          where: { email: { equals: token.email as string, mode: "insensitive" } },
        });
        if (partner) {
          token.role = "partner";
          token.partnerCode = partner.partnerCode;
          token.partnerType = partner.partnerType || "referral";
          (token as any).name = `${partner.firstName} ${partner.lastName}`.trim();
        } else {
          const pu = await prisma.partnerUser.findFirst({
            where: { email: { equals: token.email as string, mode: "insensitive" }, active: true },
          });
          if (pu) {
            const ownerPartner = await prisma.partner.findFirst({ where: { partnerCode: pu.partnerCode } });
            if (ownerPartner) {
              token.role = "partner";
              token.partnerCode = ownerPartner.partnerCode;
              token.partnerType = ownerPartner.partnerType || "referral";
              (token as any).name = `${pu.firstName} ${pu.lastName}`.trim();
            }
          }
        }
        // Still no partner match → hydrate admin role from the User row so
        // Google-authenticated admins land with their proper admin role.
        if (!token.partnerCode) {
          const adminUser = await prisma.user.findFirst({
            where: { email: { equals: token.email as string, mode: "insensitive" } },
          });
          if (adminUser) {
            token.role = adminUser.role;
            (token as any).name = adminUser.name || adminUser.email;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).partnerCode = token.partnerCode;
        (session.user as any).partnerType = token.partnerType;
        (session.user as any).authProvider = token.authProvider;
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
