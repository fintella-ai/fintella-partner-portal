import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, invalidateCachedAccessToken } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/google-calendar/oauth-callback?code=...
 *
 * Google redirects the browser here after the admin consents. We
 * exchange the authorization code for a refresh token + access token,
 * persist the refresh token + connected email on PortalSettings, then
 * send the admin back to /admin/settings with a success query param.
 *
 * Errors (user-cancelled, missing code, exchange failure) redirect
 * back with `?google_calendar=error&reason=...` so the settings page
 * can surface a friendly message.
 */
export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_PORTAL_URL || new URL(req.url).origin).trim();
  const settingsUrl = `${base.replace(/\/$/, "")}/admin/settings`;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(`${settingsUrl}?google_calendar=error&reason=unauthorized`);
  }
  const role = (session.user as any).role;
  if (role !== "super_admin") {
    return NextResponse.redirect(`${settingsUrl}?google_calendar=error&reason=forbidden`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  const stateRaw = req.nextUrl.searchParams.get("state") || "";
  const state = decodeURIComponent(stateRaw);
  if (err) {
    return NextResponse.redirect(`${settingsUrl}?google_calendar=error&reason=${encodeURIComponent(err)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?google_calendar=error&reason=no_code`);
  }

  // Per-inbox OAuth flow: state = `inbox:<inboxId>:<email>`. Route the
  // refresh token to AdminInbox instead of the global PortalSettings
  // singleton. Legacy flow (state = plain admin email) continues to
  // write to PortalSettings as before.
  const inboxMatch = /^inbox:([^:]+):/.exec(state);

  try {
    // Use the same origin-based redirect URI the oauth-start handler
    // used, so Google's token exchange sees a matching redirect_uri.
    const tokens = await exchangeCodeForTokens(code, req.nextUrl.origin);

    if (inboxMatch) {
      const inboxId = inboxMatch[1];
      await prisma.adminInbox.update({
        where: { id: inboxId },
        data: {
          googleCalendarRefreshToken: tokens.refreshToken,
          googleCalendarConnectedAt: new Date(),
        },
      });
      // Per-inbox tokens don't share the global cache, so no invalidation
      // needed — the inbox-scoped access-token helper mints fresh per call.
      return NextResponse.redirect(
        `${settingsUrl}?google_calendar=inbox_connected&inboxId=${encodeURIComponent(inboxId)}`
      );
    }

    // Legacy flow — unchanged.
    await prisma.portalSettings.upsert({
      where: { id: "global" },
      update: {
        googleCalendarRefreshToken: tokens.refreshToken,
        googleCalendarConnectedEmail: tokens.email || "",
        googleCalendarConnectedAt: new Date(),
      },
      create: {
        id: "global",
        googleCalendarRefreshToken: tokens.refreshToken,
        googleCalendarConnectedEmail: tokens.email || "",
        googleCalendarConnectedAt: new Date(),
      },
    });
    invalidateCachedAccessToken();
    return NextResponse.redirect(`${settingsUrl}?google_calendar=connected`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[google-calendar oauth-callback]", message);
    return NextResponse.redirect(
      `${settingsUrl}?google_calendar=error&reason=${encodeURIComponent(message)}`
    );
  }
}
