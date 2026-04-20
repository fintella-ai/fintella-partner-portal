// src/app/api/admin/partner-dm-flags/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REVIEWER_ROLES = new Set(["super_admin", "admin", "partner_support"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const reviewerEmail = session?.user?.email;
  const reviewerName = session?.user?.name || reviewerEmail || "Admin";
  if (!role || !reviewerEmail || !REVIEWER_ROLES.has(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const verdict = body?.verdict;
  if (verdict !== "dismissed" && verdict !== "confirmed") return NextResponse.json({ error: "verdict must be 'dismissed' or 'confirmed'" }, { status: 400 });

  const flag = await prisma.partnerDmFlag.findUnique({ where: { id: params.id }, include: { message: true } });
  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (flag.reviewedAt) return NextResponse.json({ error: "Flag already reviewed" }, { status: 409 });

  await prisma.partnerDmFlag.update({
    where: { id: params.id },
    data: { verdict, reviewedAt: new Date(), reviewedByAdminEmail: reviewerEmail },
  });

  const senderCode = flag.message.senderPartnerCode;
  if (verdict === "dismissed") {
    // Lift throttle IF it was set by this flag
    await prisma.partnerDmThrottle.updateMany({
      where: { partnerCode: senderCode, reasonFlagId: flag.id, liftedAt: null },
      data: { liftedAt: new Date() },
    });
    // Notify flagger + sender
    await prisma.notification.createMany({
      data: [
        {
          recipientType: "partner", recipientId: flag.flaggerPartnerCode,
          type: "partner_dm_flag_outcome",
          title: "Flag dismissed",
          message: `${reviewerName} reviewed your flag; no violation was found.`,
          link: `/dashboard/messages`,
        },
        {
          recipientType: "partner", recipientId: senderCode,
          type: "partner_dm_flag_outcome",
          title: "Messaging restored",
          message: `A flag on your message was reviewed and dismissed. Normal messaging is restored.`,
          link: `/dashboard/messages`,
        },
      ],
    }).catch(() => {});
  } else {
    // Promote to suspend (upsert — overrides any existing throttle)
    await prisma.partnerDmThrottle.upsert({
      where: { partnerCode: senderCode },
      update: { state: "suspended", reasonFlagId: flag.id, startedAt: new Date(), liftedAt: null },
      create: { partnerCode: senderCode, state: "suspended", reasonFlagId: flag.id },
    });
    await prisma.notification.create({
      data: {
        recipientType: "partner", recipientId: senderCode,
        type: "partner_dm_flag_outcome",
        title: "DM privileges suspended",
        message: "A flag on your message was confirmed. Contact support to appeal.",
        link: "/dashboard/support",
      },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
