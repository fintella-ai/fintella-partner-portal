"use client";

import { useCallback, useEffect, useState } from "react";

interface Meeting {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  companyName: string;
  estimatedRefund: number | null;
  partnerCode: string | null;
  dealStage: string | null;
  meetingBookedAt: string;
  meetingStartTime: string;
  meetingEndTime: string | null;
  meetingUri: string | null;
  calendarEventId: string | null;
}

function fmt$(n: number | null): string {
  if (n == null || n === 0) return "—";
  return `$${n.toLocaleString()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function endOfWeek(d: Date): Date {
  const e = new Date(d);
  e.setDate(e.getDate() + (6 - e.getDay()));
  e.setHours(23, 59, 59, 999);
  return e;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getMeetingStatus(m: Meeting): { label: string; color: string } {
  const now = new Date();
  const start = new Date(m.meetingStartTime);
  const end = m.meetingEndTime ? new Date(m.meetingEndTime) : new Date(start.getTime() + 15 * 60 * 1000);
  if (now >= start && now <= end) return { label: "LIVE NOW", color: "bg-green-500/10 text-green-400 border-green-500/20" };
  if (now > end) return { label: "COMPLETED", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
  const diff = start.getTime() - now.getTime();
  if (diff < 60 * 60 * 1000) return { label: `IN ${Math.ceil(diff / 60000)} MIN`, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  return { label: "UPCOMING", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
}

const STAGE_COLORS: Record<string, string> = {
  meeting_booked: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  qualified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  meeting_completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  gathering_info: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  agreement_sent: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  client_engaged: "bg-green-500/10 text-green-400 border-green-500/20",
  in_process: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  unresponsive: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  closedwon: "bg-green-500/10 text-green-300 border-green-500/20",
  pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function MeetingsTab() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"today" | "week" | "all">("today");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/client-submissions/meetings");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s to update statuses
  useEffect(() => {
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const now = new Date();
  const filtered = meetings.filter((m) => {
    const start = new Date(m.meetingStartTime);
    if (view === "today") return isSameDay(start, now);
    if (view === "week") return start >= startOfWeek(now) && start <= endOfWeek(now);
    return true;
  });

  const upcoming = filtered.filter((m) => new Date(m.meetingStartTime) >= now);
  const past = filtered.filter((m) => new Date(m.meetingStartTime) < now && !isSameDay(new Date(m.meetingStartTime), now) || (isSameDay(new Date(m.meetingStartTime), now) && new Date(m.meetingEndTime || m.meetingStartTime) < now));

  // Group by day for weekly view
  const byDay = new Map<string, Meeting[]>();
  for (const m of filtered) {
    const key = new Date(m.meetingStartTime).toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(m);
  }

  if (loading) return <div className="text-center py-12 font-body text-sm text-[var(--app-text-muted)]">Loading meetings...</div>;

  const todayCount = meetings.filter((m) => isSameDay(new Date(m.meetingStartTime), now)).length;
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const weekCount = meetings.filter((m) => { const s = new Date(m.meetingStartTime); return s >= weekStart && s <= weekEnd; }).length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="font-display text-2xl text-[var(--app-text)]">{todayCount}</div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Today</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-display text-2xl text-brand-gold">{weekCount}</div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">This Week</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-display text-2xl text-[var(--app-text)]">{meetings.length}</div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Total Booked</div>
        </div>
      </div>

      {/* View toggle */}
      <div className="mb-4 border-b border-[var(--app-border)]">
        <div className="flex gap-1">
          {([
            { value: "today" as const, label: "Today", count: todayCount },
            { value: "week" as const, label: "This Week", count: weekCount },
            { value: "all" as const, label: "All Meetings", count: meetings.length },
          ]).map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={`font-body text-[12px] px-3 py-2 rounded-t-lg border border-b-0 transition-colors whitespace-nowrap min-h-[36px] ${
                view === v.value
                  ? "text-brand-gold border-[var(--app-border)] bg-[var(--app-card-bg)] -mb-px font-semibold"
                  : "text-[var(--app-text-muted)] border-transparent hover:text-[var(--app-text-secondary)] hover:bg-brand-gold/5"
              }`}
            >
              {v.label}
              <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${view === v.value ? "bg-brand-gold/20 text-brand-gold" : "bg-[var(--app-input-bg)] text-[var(--app-text-muted)]"}`}>
                {v.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">📅</div>
          <h3 className="text-lg font-semibold mb-1">
            {view === "today" ? "No meetings today" : view === "week" ? "No meetings this week" : "No meetings booked yet"}
          </h3>
          <p className="text-sm text-[var(--app-text-muted)]">
            Meetings from /recover Calendly bookings will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {view === "week" || view === "all" ? (
            Array.from(byDay.entries())
              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
              .map(([dayKey, dayMeetings]) => (
                <div key={dayKey}>
                  <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-2 mt-4 first:mt-0">
                    {formatFullDate(dayMeetings[0].meetingStartTime)}
                    {isSameDay(new Date(dayKey), now) && <span className="ml-2 text-brand-gold">(Today)</span>}
                  </div>
                  <div className="space-y-2">
                    {dayMeetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
                  </div>
                </div>
              ))
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => <MeetingCard key={m.id} meeting={m} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting: m }: { meeting: Meeting }) {
  const status = getMeetingStatus(m);
  const isLive = status.label === "LIVE NOW";
  const googleMeetUrl = m.calendarEventId
    ? `https://calendar.google.com/calendar/event?eid=${btoa(m.calendarEventId)}`
    : null;

  return (
    <div className={`card p-4 transition-all ${isLive ? "ring-1 ring-green-500/30" : ""}`}>
      <div className="flex items-start gap-4">
        {/* Time block */}
        <div className="text-center min-w-[70px]">
          <div className="font-display text-lg text-[var(--app-text)]">{formatTime(m.meetingStartTime)}</div>
          {m.meetingEndTime && (
            <div className="font-body text-[10px] text-[var(--app-text-muted)]">to {formatTime(m.meetingEndTime)}</div>
          )}
          <div className="font-body text-[10px] text-[var(--app-text-faint)] mt-0.5">{formatDate(m.meetingStartTime)}</div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-[14px] text-[var(--app-text)]">{m.firstName} {m.lastName}</span>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase border ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="font-body text-[12px] text-[var(--app-text-secondary)]">{m.companyName}</div>
          <div className="flex items-center gap-3 mt-1 font-body text-[11px] text-[var(--app-text-muted)]">
            <span>{m.email}</span>
            {m.phone && <span>· {m.phone}</span>}
            {m.estimatedRefund ? <span>· Est. <strong className="text-green-400">{fmt$(m.estimatedRefund)}</strong></span> : null}
            {m.partnerCode && <span>· Partner: <span className="font-mono">{m.partnerCode}</span></span>}
          </div>
          {m.dealStage && (
            <span className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase border ${STAGE_COLORS[m.dealStage] || STAGE_COLORS.pending}`}>
              {m.dealStage.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Join button */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {m.meetingUri && (
            <a
              href={m.meetingUri}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-2 rounded-lg font-body text-[12px] font-semibold text-center transition-all ${
                isLive
                  ? "bg-green-500 text-white hover:bg-green-400"
                  : "bg-[var(--brand-gold)] text-black hover:opacity-90"
              }`}
            >
              {isLive ? "Join Now" : "Open Meeting"}
            </a>
          )}
          {googleMeetUrl && (
            <a
              href={googleMeetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 rounded-lg font-body text-[11px] text-[var(--app-text-muted)] border border-[var(--app-border)] text-center hover:text-[var(--app-text-secondary)] transition"
            >
              Calendar →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
