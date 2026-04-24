import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/inboxes/[id]/google-calendar/disconnect
 *
 * Clears `googleCalendarRefreshToken` + `googleCalendarConnectedAt` on
 * the AdminInbox. Doesn't revoke the OAuth grant with Google — that's
 * the admin's own responsibility at myaccount.google.com/permissions if
 * they want a full revoke. For portal purposes, nulling the refresh
 * token is enough to stop any free-busy / event-creation calls from
 * using the old credential.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Only super_admin or admin can disconnect an inbox calendar" },
      { status: 403 }
    );
  }

  const { id } = await params;
  try {
    const updated = await prisma.adminInbox.update({
      where: { id },
      data: {
        googleCalendarRefreshToken: null,
        googleCalendarConnectedAt: null,
      },
      select: {
        id: true,
        role: true,
        googleCalendarConnectedAt: true,
      },
    });
    return NextResponse.json({ inbox: updated });
  } catch (err) {
    console.error("[api/admin/inboxes/disconnect]", err);
    return NextResponse.json(
      { error: "Failed to disconnect inbox calendar" },
      { status: 500 }
    );
  }
}
