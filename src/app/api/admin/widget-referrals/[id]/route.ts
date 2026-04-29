import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendgrid";
import { FIRM_SHORT } from "@/lib/constants";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;
  if (!["super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status, notes } = body;

  const validStatuses = ["submitted", "contacted", "qualified", "converted", "rejected"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const referral = await prisma.widgetReferral.findUnique({
    where: { id: params.id },
    include: {
      partner: { select: { email: true, firstName: true, partnerCode: true } },
    },
  });

  if (!referral) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.widgetReferral.update({
    where: { id: params.id },
    data: {
      status,
      ...(notes !== undefined ? { notes } : {}),
    },
  });

  if (status === "converted" && referral.partner.email) {
    sendEmail({
      to: referral.partner.email,
      subject: `Your referral for ${referral.clientCompanyName} has been converted!`,
      template: "widget_referral_converted",
      partnerCode: referral.partner.partnerCode,
      text: `Hi ${referral.partner.firstName},\n\nGreat news — your widget referral for ${referral.clientCompanyName} has been converted to an active case.\n\nYou'll see commission details in your portal once the case progresses.\n\nThank you,\n${FIRM_SHORT}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#c4a050">Referral Converted!</h2><p>Hi ${referral.partner.firstName},</p><p>Great news — your widget referral for <strong>${referral.clientCompanyName}</strong> has been converted to an active case.</p><p>You'll see commission details in your portal once the case progresses.</p><p>Thank you,<br><strong>${FIRM_SHORT}</strong></p></div>`,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, referral: updated });
}
