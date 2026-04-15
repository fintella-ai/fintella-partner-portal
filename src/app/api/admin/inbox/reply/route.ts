import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendgrid";

const ALLOWED_ROLES = ["super_admin", "admin", "partner_support"];

/**
 * POST /api/admin/inbox/reply
 * Body: { inboundEmailId: string, subject?: string, body: string }
 *
 * Sends a reply to the original sender via SendGrid, flips the
 * `replied` flag on the inbound row, and (if the original email was
 * tied to a support ticket) appends a TicketMessage so the ticket
 * conversation captures the admin's response.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!ALLOWED_ROLES.includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.inboundEmailId || !body?.body) {
    return NextResponse.json(
      { error: "inboundEmailId and body required" },
      { status: 400 }
    );
  }

  const inbound = await prisma.inboundEmail.findUnique({
    where: { id: body.inboundEmailId },
  });
  if (!inbound)
    return NextResponse.json({ error: "Inbound email not found" }, { status: 404 });

  const replySubject =
    body.subject ||
    (inbound.subject.toLowerCase().startsWith("re:")
      ? inbound.subject
      : `Re: ${inbound.subject}`);

  // Plus-addressed Reply-To so when the partner hits Reply their message
  // comes back tagged with the ticket id (if any) for threading.
  const replyTo = inbound.supportTicketId
    ? `support+tkt_${inbound.supportTicketId}@inbound.fintella.partners`
    : undefined;

  const html = `<p>${(body.body as string).replace(/\n/g, "<br/>")}</p>`;

  const result = await sendEmail({
    to: inbound.fromEmail,
    toName: inbound.fromName || undefined,
    subject: replySubject,
    text: body.body,
    html,
    template: "inbox_reply",
    partnerCode: inbound.partnerCode || null,
    replyTo,
  });

  await prisma.inboundEmail.update({
    where: { id: inbound.id },
    data: { replied: true, read: true },
  });

  // Mirror the reply into the support ticket conversation if linked.
  if (inbound.supportTicketId) {
    await prisma.ticketMessage
      .create({
        data: {
          ticketId: inbound.supportTicketId,
          authorType: "admin",
          authorId: (session.user as any).email || "admin",
          content: body.body,
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({
    sent: true,
    status: result.status,
    messageId: result.messageId,
  });
}
