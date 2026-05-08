import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["super_admin", "admin", "accounting", "partner_support"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes((session.user as any).role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const meetings = await prisma.clientSubmission.findMany({
    where: { meetingStartTime: { not: null } },
    orderBy: { meetingStartTime: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      companyName: true,
      estimatedRefund: true,
      partnerCode: true,
      dealStage: true,
      meetingBookedAt: true,
      meetingStartTime: true,
      meetingEndTime: true,
      meetingUri: true,
      calendarEventId: true,
    },
  });

  return NextResponse.json({ meetings });
}
