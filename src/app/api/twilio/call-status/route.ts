import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTwilioCallStatus } from "@/lib/twilio-voice";

/**
 * Twilio Voice Status Callback (Phase 15c)
 *
 * Twilio POSTs to this URL as the call progresses through its lifecycle:
 *   initiated → ringing → in-progress → completed
 *   (or → failed / no-answer / busy / canceled)
 *
 * We update the matching CallLog row in place so the admin Communication
 * Log Phone tab reflects real-time status.
 *
 * Twilio's status callback fields (form-urlencoded):
 *   CallSid, CallStatus, CallDuration (seconds, only on completed),
 *   From, To, Direction, Timestamp, RecordingUrl (if recording enabled),
 *   RecordingDuration, etc.
 *
 * The `logId` query param (set by initiateBridgedCall when the call was
 * originated) lets us update the right row directly without scanning by
 * CallSid. We also fall back to CallSid lookup as a safety net.
 *
 * Always returns 200 — Twilio retries non-200 responses.
 */
export async function POST(req: NextRequest) {
  try {
    const logIdQuery = req.nextUrl.searchParams.get("logId");
    const rawBody = await req.text();
    const usp = new URLSearchParams(rawBody);

    const callSid = usp.get("CallSid") || null;
    const callStatus = usp.get("CallStatus") || "initiated";
    const callDuration = usp.get("CallDuration");
    const recordingUrl = usp.get("RecordingUrl");
    const recordingDuration = usp.get("RecordingDuration");

    // Find the CallLog row — prefer the explicit logId from the query
    // param (set when we originated the call), fall back to CallSid.
    let logRow = null;
    if (logIdQuery) {
      logRow = await prisma.callLog
        .findUnique({ where: { id: logIdQuery } })
        .catch(() => null);
    }
    if (!logRow && callSid) {
      logRow = await prisma.callLog
        .findFirst({ where: { providerCallSid: callSid } })
        .catch(() => null);
    }

    if (!logRow) {
      // Unknown call — still 200 so Twilio doesn't retry forever.
      console.warn(
        `[TwilioCallStatus] no matching CallLog row for sid=${callSid} logId=${logIdQuery}`
      );
      return NextResponse.json({ received: true });
    }

    const normalizedStatus = normalizeTwilioCallStatus(callStatus);
    const isTerminal =
      normalizedStatus === "completed" ||
      normalizedStatus === "failed" ||
      normalizedStatus === "no-answer" ||
      normalizedStatus === "busy" ||
      normalizedStatus === "canceled";

    const updateData: Record<string, any> = {
      status: normalizedStatus,
      ...(callSid && !logRow.providerCallSid && { providerCallSid: callSid }),
    };
    if (callDuration && !isNaN(Number(callDuration))) {
      updateData.durationSeconds = Number(callDuration);
    }
    if (recordingUrl) {
      updateData.recordingUrl = recordingUrl;
    }
    if (recordingDuration && !isNaN(Number(recordingDuration))) {
      updateData.recordingDurationSeconds = Number(recordingDuration);
    }
    if (isTerminal && !logRow.completedAt) {
      updateData.completedAt = new Date();
    }

    await prisma.callLog
      .update({
        where: { id: logRow.id },
        data: updateData,
      })
      .catch((err) =>
        console.error("[TwilioCallStatus] failed to update CallLog:", err)
      );

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[TwilioCallStatus] handler threw:", err);
    return NextResponse.json({ received: true });
  }
}

// Twilio sometimes does GET probes to verify reachability.
export async function GET() {
  return NextResponse.json({ ok: true });
}
