import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildDriveAuthorizationUrl } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/google-drive/oauth-start
 * super_admin-only. Redirects to Google's consent screen for the
 * dedicated Drive connection. Callback stores the refresh token on
 * PortalSettings (singleton).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Only super admins can connect Google Drive" }, { status: 403 });
  }
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth client credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET on Vercel." },
      { status: 500 }
    );
  }
  const state = encodeURIComponent(session.user.email || "unknown");
  return NextResponse.redirect(buildDriveAuthorizationUrl(state, req.nextUrl.origin));
}
