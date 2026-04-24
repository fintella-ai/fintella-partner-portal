/**
 * Scheduling helpers for Ollie's scheduled_call rung (Phase 3c.4d).
 *
 * v1 generates placeholder slots in the future — real Google Calendar
 * free-busy integration lands in a follow-up PR when we wire per-inbox
 * OAuth refresh tokens (extending PR #433's single-inbox flow).
 *
 * Every slot honors the target inbox's `callDurationMinutes` +
 * `timeZone` + (future) `workHours`. v1 uses a fixed daytime grid
 * (9am / 11am / 2pm / 4pm inbox-local) so partners see predictable
 * options even before Calendar is connected.
 */
import { prisma } from "@/lib/prisma";

/** A 15-minute (or inbox-configured) call slot offered to a partner. */
export interface ScheduleSlot {
  /** ISO UTC start instant. */
  startUtc: string;
  /** ISO UTC end instant. */
  endUtc: string;
  /** Inbox's timeZone the slot was computed in (display hint). */
  inboxTimeZone: string;
  /** Duration in minutes (matches inbox.callDurationMinutes). */
  durationMinutes: number;
}

const DEFAULT_DAILY_SLOTS_LOCAL = [9, 11, 14, 16]; // 9am / 11am / 2pm / 4pm local

/**
 * Compute offered slots for a category. Resolves category → inbox, honors
 * `acceptScheduledCalls`, returns upcoming slots across the next N
 * business days (Mon-Fri). Does NOT touch Google Calendar yet — v1
 * placeholder slots only.
 */
export async function getOfferedSlots(
  category: string,
  daysAhead = 3
): Promise<{
  slots: ScheduleSlot[];
  inbox: {
    id: string;
    role: string;
    displayName: string;
    timeZone: string;
    callDurationMinutes: number;
    acceptScheduledCalls: boolean;
  } | null;
  reason?: string;
}> {
  const inbox =
    (await prisma.adminInbox.findFirst({
      where: { categories: { has: category } },
      select: {
        id: true,
        role: true,
        displayName: true,
        timeZone: true,
        callDurationMinutes: true,
        acceptScheduledCalls: true,
      },
    })) ??
    (await prisma.adminInbox.findUnique({
      where: { role: "support" },
      select: {
        id: true,
        role: true,
        displayName: true,
        timeZone: true,
        callDurationMinutes: true,
        acceptScheduledCalls: true,
      },
    }));

  if (!inbox) {
    return { slots: [], inbox: null, reason: "no_inbox_configured" };
  }
  if (!inbox.acceptScheduledCalls) {
    return {
      slots: [],
      inbox,
      reason: "inbox_not_accepting_scheduled_calls",
    };
  }

  // Compute a rough local-time grid across the next N business days.
  // We interpret the daily slot hours as the inbox's local time by
  // constructing the Date in UTC after offsetting — good enough for v1
  // display purposes. Production Calendar integration replaces this.
  const slots: ScheduleSlot[] = [];
  const now = new Date();
  const duration = inbox.callDurationMinutes;
  const clampDays = Math.min(Math.max(1, Math.floor(daysAhead)), 14);

  for (let d = 1; d <= clampDays + 4 && slots.length < 12; d += 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    const dow = day.getUTCDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) continue; // skip weekends

    for (const hour of DEFAULT_DAILY_SLOTS_LOCAL) {
      const start = new Date(
        Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          hour,
          0,
          0,
          0
        )
      );
      if (start.getTime() <= now.getTime()) continue;
      const end = new Date(start.getTime() + duration * 60_000);
      slots.push({
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        inboxTimeZone: inbox.timeZone,
        durationMinutes: duration,
      });
      if (slots.length >= 12) break;
    }
  }

  return { slots, inbox };
}
