import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAuthorizationUrl } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inboxes/[id]/google-calendar/connect
 *
 * Kicks off Google OAuth scoped to a specific AdminInbox. State carries
 * `inbox:<inboxId>:<adminEmail>` so the shared callback at
 * /api/admin/google-calendar/oauth-callback can route the refresh token
 * to the right AdminInbox row.
 *
 * Reuses the existing redirect URI (already registered with Google
 * Cloud) to avoid a Google Console change per new flow.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Only super_admin or admin can connect an inbox calendar" },
      { status: 403 }
    );
  }

  if (
    !process.env.GOOGLE_OAUTH_CLIENT_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET
  ) {
    return NextResponse.json(
      {
        error:
          "Google OAuth client credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET on Vercel.",
      },
      { status: 500 }
    );
  }

  const { id } = await params;
  // Confirm the inbox exists before burning the OAuth hop.
  const inbox = await prisma.adminInbox.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!inbox) {
    return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
  }

  const email = session.user.email || "unknown";
  // State prefix `inbox:` lets the shared callback disambiguate this
  // flow from the legacy PortalSettings-singleton flow.
  const state = encodeURIComponent(`inbox:${id}:${email}`);
  return NextResponse.redirect(
    buildAuthorizationUrl(state, req.nextUrl.origin)
  );
}
