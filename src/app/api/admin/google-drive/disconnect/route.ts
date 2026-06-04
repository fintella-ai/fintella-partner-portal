import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateCachedDriveAccessToken } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/google-drive/disconnect
 * super_admin-only. Clears the Drive connection (keeps the folder ID).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.portalSettings.update({
    where: { id: "global" },
    data: { googleDriveRefreshToken: null, googleDriveConnectedEmail: null },
  });
  invalidateCachedDriveAccessToken();
  return NextResponse.json({ ok: true });
}
