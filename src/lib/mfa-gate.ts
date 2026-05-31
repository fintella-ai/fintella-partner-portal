import { prisma } from "./prisma";

/**
 * Server-side MFA enforcement gate (the "Google-OR-TOTP" model).
 *
 * Returns true ONLY when ALL of the following hold, so it can never disrupt an
 * existing or Google session:
 *   1. The per-portal toggle is ON (PortalSettings.mfaRequired{Partners,Admins}).
 *   2. The session was created via this portal's EMAIL/PASSWORD provider
 *      (authProvider === "credentials-partner" | "credentials-admin").
 *      Google ("google"), impersonation, and legacy tokens (authProvider
 *      undefined) are all exempt.
 *   3. The login identity has NOT yet enrolled TOTP.
 *
 * Consumed by GET /api/auth/mfa-status, which the client MfaEnforcementGate
 * polls to decide whether to render the mandatory-enrollment screen. No
 * redirects, no middleware changes, no logout loops.
 */
export async function mustEnrollMfa(
  session: any,
  portal: "partner" | "admin"
): Promise<boolean> {
  const authProvider = session?.user?.authProvider;
  const email = session?.user?.email;
  if (!email) return false;

  if (portal === "partner") {
    if (authProvider !== "credentials-partner") return false;
    const settings = await prisma.portalSettings.findFirst();
    if (!settings?.mfaRequiredPartners) return false;

    // Resolve the login identity (PartnerUser first, then Partner) — same order
    // as the partner-login provider in auth.ts.
    const partnerUser = await prisma.partnerUser.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, active: true },
      select: { totpEnabled: true },
    });
    if (partnerUser) return !partnerUser.totpEnabled;

    const partner = await prisma.partner.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { totpEnabled: true },
    });
    return partner ? !partner.totpEnabled : false;
  }

  // admin
  if (authProvider !== "credentials-admin") return false;
  const settings = await prisma.portalSettings.findFirst();
  if (!settings?.mfaRequiredAdmins) return false;

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { totpEnabled: true },
  });
  return user ? !user.totpEnabled : false;
}
