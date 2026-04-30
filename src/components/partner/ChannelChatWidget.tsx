"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChannelMessage = {
  id: string;
  authorName: string;
  content: string;
  messageType: string;
  createdAt: string;
};

type Channel = {
  id: string;
  name: string;
  description: string | null;
  replyMode?: string;
  recentMessages: ChannelMessage[];
};

type ReplyMessage = {
  id: string;
  senderType: string;
  senderName: string;
  content: string;
  createdAt: string;
};

const LS_OPEN = "fintella.partner.channelWidget.open";
const LS_POS = "fintella.partner.channelWidget.pos";
const LS_CHANNEL = "fintella.partner.channelWidget.channelId";

declare global {
  interface Window {
    __fintellaChannelWidget?: {
      open: (channelId?: string) => void;
      close: () => void;
      toggle: () => void;
    };
  }
}

export default function ChannelChatWidget() {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [replyThread, setReplyThread] = useState<ReplyMessage[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [sending, setSending] = useState(false);
  const lastSeenRef = useRef<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const WIDGET_W = 380;
  const WIDGET_H = 520;

  useEffect(() => {
    try {
      const savedOpen = window.localStorage.getItem(LS_OPEN);
      if (savedOpen === "true") setOpen(true);
      const savedPos = window.localStorage.getItem(LS_POS);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        const maxX = window.innerWidth - Math.min(WIDGET_W, window.innerWidth - 32);
        const maxY = window.innerHeight - Math.min(WIDGET_H, window.innerHeight - 120);
        if (parsed?.x >= 0 && parsed?.y >= 0 && parsed.x <= Math.max(0, maxX) && parsed.y <= Math.max(0, maxY)) {
          setPos(parsed);
        } else {
          window.localStorage.removeItem(LS_POS);
        }
      }
      const savedChannel = window.localStorage.getItem(LS_CHANNEL);
      if (savedChannel) setActiveChannelId(savedChannel);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(LS_OPEN, String(open)); } catch {}
  }, [open]);

  useEffect(() => {
    if (pos) try { window.localStorage.setItem(LS_POS, JSON.stringify(pos)); } catch {}
  }, [pos]);

  useEffect(() => {
    if (activeChannelId) try { window.localStorage.setItem(LS_CHANNEL, activeChannelId); } catch {}
  }, [activeChannelId]);

  useEffect(() => {
    window.__fintellaChannelWidget = {
      open: (channelId?: string) => { if (channelId) setActiveChannelId(channelId); setOpen(true); },
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
    };
    return () => { delete window.__fintellaChannelWidget; };
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const r = await fetch("/api/announcements");
      if (!r.ok) return;
      const d = await r.json();
      setChannels(d.channels || []);

      let unread = 0;
      for (const ch of (d.channels || [])) {
        const latest = ch.recentMessages?.[ch.recentMessages.length - 1];
        if (latest && latest.createdAt > (lastSeenRef.current[ch.id] || "")) unread++;
      }
      setUnreadCount(unread);
    } catch {}
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  useEffect(() => {
    const interval = setInterval(loadChannels, 30000);
    return () => clearInterval(interval);
  }, [loadChannels]);

  useEffect(() => {
    if (!activeChannelId) return;
    const ch = channels.find((c) => c.id === activeChannelId);
    if (ch) {
      setMessages(ch.recentMessages || []);
      const latest = ch.recentMessages?.[ch.recentMessages.length - 1];
      if (latest) lastSeenRef.current[ch.id] = latest.createdAt;
    }
  }, [activeChannelId, channels]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadReplyThread = useCallback(async () => {
    if (!activeChannelId) return;
    try {
      const r = await fetch(`/api/announcements/${activeChannelId}/reply-thread`);
      if (!r.ok) return;
      const d = await r.json();
      setReplyThread(d.messages || []);
    } catch {}
  }, [activeChannelId]);

  useEffect(() => {
    if (showReply && activeChannelId) loadReplyThread();
  }, [showReply, activeChannelId, loadReplyThread]);

  const sendReply = async () => {
    if (!replyDraft.trim() || !activeChannelId) return;
    setSending(true);
    try {
      const r = await fetch(`/api/announcements/${activeChannelId}/reply-thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyDraft.trim() }),
      });
      if (r.ok) {
        setReplyDraft("");
        await loadReplyThread();
      }
    } catch {} finally {
      setSending(false);
    }
  };

  const onDragStart = (e: React.PointerEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const el = panelRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const newX = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - w));
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - h));
    setPos({ x: newX, y: newY });
  };

  const onDragEnd = () => setDragging(false);

  if (!hydrated) return null;

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Collapsed FAB
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[900] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
          right: "calc(1.5rem + env(safe-area-inset-right, 0px))",
          background: "linear-gradient(135deg, #c4a050 0%, #f0d070 100%)",
        }}
        title="Channels"
      >
        <span className="text-xl">📣</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  const panelStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 24, bottom: 88 };

  return (
    <div
      ref={panelRef}
      className="fixed z-[900] flex flex-col rounded-2xl shadow-2xl shadow-black/40 border border-[var(--app-border)] overflow-hidden"
      style={{
        width: `min(${WIDGET_W}px, calc(100vw - 2rem))`,
        height: `min(${WIDGET_H}px, calc(100vh - 8rem))`,
        background: "var(--app-bg-secondary)",
        ...panelStyle,
      }}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-[var(--app-border)] select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ background: "var(--app-bg-secondary)" }}
      >
        <span className="text-lg">📣</span>
        <span className="font-display text-sm font-semibold text-[var(--app-text)] flex-1 truncate">
          {activeChannel ? activeChannel.name : "Channels"}
        </span>
        {activeChannel && (
          <button
            onClick={() => { setActiveChannelId(null); setShowReply(false); }}
            className="font-body text-[10px] theme-text-muted hover:text-[var(--app-text)] px-1"
            title="Back to channel list"
          >
            ←
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--app-hover)] theme-text-muted text-sm"
          title="Minimize"
        >
          ✕
        </button>
      </div>

      {/* Channel list OR active channel */}
      {!activeChannel ? (
        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <div className="p-6 text-center font-body text-[13px] theme-text-muted">No channels yet.</div>
          ) : (
            <div className="divide-y divide-[var(--app-border)]">
              {channels.map((ch) => {
                const latest = ch.recentMessages?.[ch.recentMessages.length - 1];
                const hasUnread = latest && latest.createdAt > (lastSeenRef.current[ch.id] || "");
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannelId(ch.id)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--app-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-body text-[13px] font-medium text-[var(--app-text)] flex-1 truncate">
                        {ch.name}
                      </span>
                      {hasUnread && <span className="w-2 h-2 rounded-full bg-brand-gold shrink-0" />}
                    </div>
                    {latest && (
                      <div className="font-body text-[11px] theme-text-muted truncate mt-0.5">
                        {latest.authorName}: {latest.content.slice(0, 60)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 ? (
              <div className="text-center font-body text-[12px] theme-text-muted py-6">No messages yet.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="rounded-lg bg-[var(--app-input-bg)] px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-body text-[11px] font-semibold text-[var(--app-text)]">{m.authorName}</span>
                    <span className="font-body text-[10px] theme-text-faint">
                      {new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="font-body text-[12px] text-[var(--app-text)] whitespace-pre-wrap">{m.content}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply toggle + thread */}
          {activeChannel.replyMode !== "disabled" && (
            <div className="border-t border-[var(--app-border)]">
              {!showReply ? (
                <button
                  onClick={() => setShowReply(true)}
                  className="w-full px-3 py-2 font-body text-[12px] text-brand-gold hover:bg-[var(--app-hover)] text-left"
                >
                  💬 Reply to admin…
                </button>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  {replyThread.length > 0 && (
                    <div className="px-3 py-1 space-y-1">
                      {replyThread.slice(-5).map((r) => (
                        <div key={r.id} className={`font-body text-[11px] ${r.senderType === "partner" ? "text-brand-gold" : "text-[var(--app-text)]"}`}>
                          <span className="font-semibold">{r.senderName}:</span> {r.content}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 px-3 py-2">
                    <input
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                      placeholder="Type a reply…"
                      className="theme-input flex-1 text-[12px] py-1.5 px-2"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !replyDraft.trim()}
                      className="theme-btn-primary text-[11px] px-3 py-1.5 disabled:opacity-50"
                    >
                      {sending ? "…" : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
