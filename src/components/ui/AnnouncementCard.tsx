"use client";

// Component: AnnouncementCard
// Renders a single ChannelMessage. Text bubbles show author/timestamp/content.
// call_link type renders a prominent call card with a "Join Call" button.

type ChannelMessageLike = {
  id: string;
  authorName: string;
  content: string;
  messageType: string;      // "text" | "call_link"
  callMeta: string | null;  // JSON
  editedAt: string | null | Date;
  deletedAt: string | null | Date;
  createdAt: string | Date;
};

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString();
}

function parseCallMeta(raw: string | null): {
  url?: string;
  title?: string;
  startsAt?: string;
  durationMins?: number;
  provider?: string;
} {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function AnnouncementCard({ message }: { message: ChannelMessageLike }) {
  if (message.deletedAt) {
    return (
      <div id={`msg-${message.id}`} className="theme-card p-3 opacity-60 italic text-sm">
        (deleted announcement)
      </div>
    );
  }

  if (message.messageType === "call_link") {
    const meta = parseCallMeta(message.callMeta);
    const startLabel = meta.startsAt ? new Date(meta.startsAt).toLocaleString() : null;
    return (
      <div id={`msg-${message.id}`} className="theme-card p-4 border-l-4 border-[var(--app-accent,#3b82f6)] space-y-2">
        <div className="flex items-center gap-2 text-xs opacity-70">
          <span>📞</span>
          {meta.provider && (
            <span className="theme-pill text-[11px]">{meta.provider}</span>
          )}
          <span>· {message.authorName} · {formatDate(message.createdAt)}</span>
        </div>
        {meta.title && <div className="font-semibold text-base">{meta.title}</div>}
        {message.content && <div className="text-sm whitespace-pre-wrap">{message.content}</div>}
        <div className="text-xs opacity-80 flex flex-wrap gap-3">
          {startLabel && <span>🕒 {startLabel}</span>}
          {meta.durationMins != null && <span>⏱ {meta.durationMins} min</span>}
        </div>
        {meta.url && (
          <a
            href={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block theme-btn-primary text-sm px-3 py-1.5"
          >
            Join call ↗
          </a>
        )}
        {message.editedAt && <div className="text-[11px] opacity-50">(edited {formatDate(message.editedAt as any)})</div>}
      </div>
    );
  }

  // text
  return (
    <div id={`msg-${message.id}`} className="theme-card p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs opacity-70">
        <span className="font-medium">{message.authorName}</span>
        <span>· {formatDate(message.createdAt)}</span>
        {message.editedAt && <span className="italic">(edited)</span>}
      </div>
      <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
    </div>
  );
}
