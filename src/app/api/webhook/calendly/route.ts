import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEventOnInboxCalendar } from "@/lib/google-calendar";

/**
 * POST /api/webhook/calendly
 * Handles Calendly webhook events (invitee.created).
 * - Matches invitee email to ClientSubmission
 * - Updates meeting date/time + sets dealStage to meeting_booked
 * - Creates Google Calendar event on admin@fintella.partners
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body.event;
    const payload = body.payload;

    if (event !== "invitee.created") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const inviteeEmail = payload?.email?.toLowerCase?.();
    const inviteeName = payload?.name || "";
    const eventUri = payload?.event || payload?.uri || null;
    const scheduledEvent = payload?.scheduled_event || {};
    const startTime = scheduledEvent.start_time || null;
    const endTime = scheduledEvent.end_time || null;

    if (!inviteeEmail) {
      console.warn("[webhook/calendly] invitee.created with no email, skipping");
      return NextResponse.json({ ok: true, skipped: true });
    }

    console.log(`[webhook/calendly] invitee.created: ${inviteeEmail} at ${startTime}`);

    const submission = await prisma.clientSubmission.findFirst({
      where: { email: inviteeEmail },
      orderBy: { createdAt: "desc" },
    });

    if (!submission) {
      console.log(`[webhook/calendly] no ClientSubmission found for ${inviteeEmail}`);
      return NextResponse.json({ ok: true, matched: false });
    }

    // Create Google Calendar event on admin inbox
    let calendarEventId: string | null = null;
    const adminInbox = await prisma.adminInbox.findUnique({
      where: { emailAddress: "admin@fintella.partners" },
      select: { id: true, googleCalendarRefreshToken: true },
    });

    if (adminInbox?.googleCalendarRefreshToken && startTime && endTime) {
      const calResult = await createEventOnInboxCalendar(
        adminInbox.googleCalendarRefreshToken,
        adminInbox.id,
        {
          summary: `IEEPA Refund Call — ${inviteeName || submission.firstName + " " + submission.lastName}`,
          description: [
            `Company: ${submission.companyName}`,
            `Email: ${submission.email}`,
            submission.phone ? `Phone: ${submission.phone}` : null,
            submission.estimatedRefund ? `Est. Recovery: $${submission.estimatedRefund.toLocaleString()}` : null,
            submission.partnerCode ? `Partner: ${submission.partnerCode}` : "Direct lead",
            `\nBooked via Calendly`,
          ].filter(Boolean).join("\n"),
          startIso: startTime,
          endIso: endTime,
          attendeeEmails: [inviteeEmail],
        }
      );
      if (calResult?.id) {
        calendarEventId = calResult.id;
        console.log(`[webhook/calendly] Google Calendar event created: ${calResult.id}`);
      }
    }

    // Update ClientSubmission: meeting info + stage
    await prisma.clientSubmission.update({
      where: { id: submission.id },
      data: {
        meetingBookedAt: new Date(),
        meetingStartTime: startTime ? new Date(startTime) : null,
        meetingEndTime: endTime ? new Date(endTime) : null,
        meetingUri: eventUri,
        calendarEventId,
        dealStage: "meeting_booked",
      },
    });

    console.log(`[webhook/calendly] ClientSubmission ${submission.id} updated to meeting_booked`);

    return NextResponse.json({ ok: true, matched: true, submissionId: submission.id });
  } catch (err) {
    console.error("[webhook/calendly] error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
