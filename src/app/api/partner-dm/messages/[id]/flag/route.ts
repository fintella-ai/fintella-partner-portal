// src/app/api/partner-dm/messages/[id]/flag/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishPortalChatEvent } from "@/lib/portalChatEvents";

const FLAG_DAILY_LIMIT = 10;
const FLAG_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const flaggerPartnerCode = (session?.user as any)?.partnerCode;
  if (!flaggerPartnerCode) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msg = await prisma.partnerDmMessage.findUnique({
    where: { id: params.id },
    include: { thread: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.deletedAt) return NextResponse.json({ error: "Message deleted" }, { status: 404 });

  // Must be participant, must not be own message.
  const isParticipant =
    msg.thread.participantA === flaggerPartnerCode || msg.thread.participantB === flaggerPartnerCode;
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (msg.senderPartnerCode === flaggerPartnerCode) {
    return NextResponse.json({ error: "Cannot flag your own message" }, { status: 400 });
  }

  // Daily-flag cap per flagger
  const recent = await prisma.partnerDmFlag.count({
    where: { flaggerPartnerCode, createdAt: { gt: new Date(Date.now() - FLAG_WINDOW_MS) } },
  });
  if (recent >= FLAG_DAILY_LIMIT) return NextResponse.json({ error: "Flag limit reached for today" }, { status: 429 });

  // Duplicate check
  const dup = await prisma.partnerDmFlag.findFirst({
    where: { messageId: params.id, flaggerPartnerCode, reviewedAt: null },
  });
  if (dup) return NextResponse.json({ error: "Message already flagged by you" }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 1000) : null;

  const flag = await prisma.partnerDmFlag.create({
    data: { messageId: params.id, flaggerPartnerCode, reason },
  });

  // Throttle the sender (if not already throttled or suspended)
  const existing = await prisma.partnerDmThrottle.findUnique({ where: { partnerCode: msg.senderPartnerCode } });
  if (!existing || existing.liftedAt) {
    await prisma.partnerDmThrottle.upsert({
      where: { partnerCode: msg.senderPartnerCode },
      update: { state: "throttled", reasonFlagId: flag.id, startedAt: new Date(), liftedAt: null },
      create: { partnerCode: msg.senderPartnerCode, state: "throttled", reasonFlagId: flag.id },
    });
  }

  // Notify admins with review role
  const reviewers = await prisma.user.findMany({
    where: { role: { in: ["super_admin", "admin", "partner_support"] } },
    select: { email: true },
  });
  if (reviewers.length > 0) {
    await prisma.notification.createMany({
      data: reviewers.map((r) => ({
        recipientType: "admin",
        recipientId: r.email,
        type: "partner_dm_flag",
        title: "Partner DM flagged for review",
        message: (reason ?? msg.content).slice(0, 100),
        link: `/admin/partner-dm-flags/${flag.id}`,
      })),
    }).catch(() => {});
  }

  await publishPortalChatEvent({ event: "partner_dm.flag.created", flagId: flag.id, messageId: msg.id });

  return NextResponse.json({ flag }, { status: 201 });
}
