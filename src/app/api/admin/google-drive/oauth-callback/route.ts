import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeDriveCodeForTokens, invalidateCachedDriveAccessToken } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/google-drive/oauth-callback?code=...
 * Exchanges the code, stores refresh token + connected email on
 * PortalSettings, redirects back to /admin/settings with a status flag.
 */
export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_PORTAL_URL || new URL(req.url).origin).trim();
  const settingsUrl = `${base.replace(/\/$/, "")}/admin/settings`;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=unauthorized`);
  }
  const role = (session.user as any).role;
  if (role !== "super_admin") {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=forbidden`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=${encodeURIComponent(err)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=no_code`);
  }

  try {
    const tokens = await exchangeDriveCodeForTokens(code, req.nextUrl.origin);
    await prisma.portalSettings.upsert({
      where: { id: "global" },
      update: {
        googleDriveRefreshToken: tokens.refreshToken,
        googleDriveConnectedEmail: tokens.email || "",
      },
      create: {
        id: "global",
        googleDriveRefreshToken: tokens.refreshToken,
        googleDriveConnectedEmail: tokens.email || "",
      },
    });
    invalidateCachedDriveAccessToken();
    return NextResponse.redirect(`${settingsUrl}?google_drive=connected`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[google-drive oauth-callback]", message);
    return NextResponse.redirect(`${settingsUrl}?google_drive=error&reason=${encodeURIComponent(message)}`);
  }
}
