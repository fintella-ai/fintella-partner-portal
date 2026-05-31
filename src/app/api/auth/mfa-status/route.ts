import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mustEnrollMfa } from "@/lib/mfa-gate";

/**
 * Tells the client whether the CURRENT session must enroll in TOTP before using
 * the portal. Drives MfaEnforcementGate. Portal is inferred from the session
 * role (partner role → partner portal; any admin role → admin portal). All the
 * real "should this session be challenged" logic lives in mustEnrollMfa, which
 * is intentionally conservative (Google / passkey / impersonation / legacy
 * sessions and not-yet-enabled toggles all return false).
 *
 * A more specific static segment ("mfa-status") takes priority over the
 * NextAuth [...nextauth] catch-all in the same /api/auth folder.
 */
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !role) {
    return NextResponse.json({ mustEnroll: false });
  }
  const portal = role === "partner" ? "partner" : "admin";
  const mustEnroll = await mustEnrollMfa(session, portal);
  return NextResponse.json({ mustEnroll, portal });
}
