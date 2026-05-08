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

    // Only process the IEEPA Tariff Refund Initial Call event type
    const IEEPA_EVENT_TYPE = "https://api.calendly.com/event_types/b4c3ca2f-0cfd-4dc0-ad45-c5222061dc4a";
    const scheduledEvent = payload?.scheduled_event || {};
    const eventTypeUri = scheduledEvent.event_type || null;
    if (eventTypeUri && eventTypeUri !== IEEPA_EVENT_TYPE) {
      console.log(`[webhook/calendly] skipping non-IEEPA event type: ${eventTypeUri}`);
      return NextResponse.json({ ok: true, skipped: true, reason: "wrong_event_type" });
    }

    const inviteeEmail = payload?.email?.toLowerCase?.();
    const inviteeName = payload?.name || "";
    const eventUri = payload?.event || payload?.uri || null;
    const startTime = scheduledEvent.start_time || null;
    const endTime = scheduledEvent.end_time || null;

    if (!inviteeEmail) {
      console.warn("[webhook/calendly] invitee.created with no email, skipping");
      return NextResponse.json({ ok: true, skipped: true });
    }

    console.log(`[webhook/calendly] invitee.created: ${inviteeEmail} at ${startTime}`);

    // Try exact email match first
    let submission = await prisma.clientSubmission.findFirst({
      where: { email: inviteeEmail },
      orderBy: { createdAt: "desc" },
    });

    // Fuzzy fallback: match by first + last name within last hour
    if (!submission && inviteeName) {
      const names = inviteeName.trim().split(/\s+/);
      const first = names[0]?.toLowerCase();
      const last = names.slice(1).join(" ").toLowerCase();
      if (first && last) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        submission = await prisma.clientSubmission.findFirst({
          where: {
            firstName: { equals: first, mode: "insensitive" },
            lastName: { equals: last, mode: "insensitive" },
            createdAt: { gte: oneHourAgo },
          },
          orderBy: { createdAt: "desc" },
        });
        if (submission) {
          console.log(`[webhook/calendly] fuzzy match by name: ${inviteeName} → submission ${submission.id}`);
        }
      }
    }

    if (!submission) {
      console.log(`[webhook/calendly] no ClientSubmission found for ${inviteeEmail} / ${inviteeName}`);
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
