// src/app/api/admin/partner-dm-flags/suspensions/[partnerCode]/lift/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { partnerCode: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden (super_admin only)" }, { status: 403 });

  await prisma.partnerDmThrottle.updateMany({
    where: { partnerCode: params.partnerCode, liftedAt: null },
    data: { liftedAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      recipientType: "partner", recipientId: params.partnerCode,
      type: "partner_dm_flag_outcome",
      title: "DM privileges restored",
      message: "Your DM suspension has been lifted by a super admin.",
      link: "/dashboard/messages",
    },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
