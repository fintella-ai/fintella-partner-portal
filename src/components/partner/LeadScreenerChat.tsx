"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

interface Props {
  partnerCode: string;
  onLeadCreated?: () => void;
  onClose?: () => void;
}

export default function LeadScreenerChat({ partnerCode, onLeadCreated, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState<{ score: number; hot: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: "Hi there! I'm here to help learn a bit about your prospect before you get on a call. Tell me about them — what does their company do, and do they import goods into the US?",
    }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || sending || done) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated.filter((m) => m.role === "user" || m.role === "assistant"), partnerCode }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.done) {
        setDone(true);
        setScore(data.score);
        onLeadCreated?.();
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card flex flex-col" style={{ height: 480 }}>
      <div className="px-4 py-3 border-b border-[var(--app-border)] flex items-center justify-between">
        <div>
          <div className="font-body text-sm font-semibold">AI Lead Screener</div>
          <div className="font-body text-[11px] text-[var(--app-text-muted)]">Describe your prospect — AI will score and add to your pipeline</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="font-body text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-lg px-2">×</button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
              msg.role === "user"
                ? "bg-brand-gold/15 border border-brand-gold/20 rounded-br-sm"
                : "bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-bl-sm"
            }`}>
              <div className="font-body text-[13px] text-[var(--app-text)] whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-xl rounded-bl-sm px-4 py-2.5">
              <div className="font-body text-[13px] text-[var(--app-text-muted)] animate-pulse">Thinking...</div>
            </div>
          </div>
        )}
        {done && score && (
          <div className={`p-3 rounded-lg border text-center ${
            score.hot ? "bg-green-500/10 border-green-500/20" : score.score >= 40 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-[var(--app-input-bg)] border-[var(--app-border)]"
          }`}>
            <div className={`font-display text-2xl font-bold ${score.hot ? "text-green-400" : score.score >= 40 ? "text-yellow-400" : "text-[var(--app-text-muted)]"}`}>
              {score.score}/100
            </div>
            <div className="font-body text-[12px] text-[var(--app-text-muted)] mt-1">
              {score.hot ? "🔥 Hot lead — added to your Qualified pipeline" : score.score >= 40 ? "Warm lead — added to Contacted" : "Cold lead — added for follow-up"}
            </div>
          </div>
        )}
      </div>

      {!done && (
        <div className="p-3 border-t border-[var(--app-border)] flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="flex-1 bg-[var(--app-input-bg)] border border-[var(--app-border)] rounded-xl px-4 py-2.5 font-body text-sm text-[var(--app-text)] outline-none focus:border-brand-gold/40"
            placeholder="Describe your prospect..."
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="bg-brand-gold/20 text-brand-gold border border-brand-gold/30 rounded-xl px-5 font-body text-sm font-semibold hover:bg-brand-gold/30 transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
