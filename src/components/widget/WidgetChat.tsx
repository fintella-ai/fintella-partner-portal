"use client";

import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { W, RADII, SHADOWS, glassCardStyle, goldButtonStyle, inputStyle } from "./widget-theme";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME = "Hi! I can help you set up and use the Fintella widget in your TMS. What do you need help with?";
const CHIPS = ["How to install", "Troubleshoot", "Features"];

const SECTION_ACCENTS = [
  "rgba(196,160,80,0.5)",
  "rgba(79,110,247,0.5)",
  "rgba(34,197,94,0.5)",
  "rgba(168,85,247,0.5)",
  "rgba(245,158,11,0.5)",
];

function renderAiContent(content: string) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let sectionIdx = 0;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <div key={`list-${elements.length}`} style={{
        display: "flex", flexDirection: "column", gap: 4, margin: "4px 0",
      }}>
        {listItems.map((item, j) => (
          <div key={j} style={{
            display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5,
            color: W.textSecondary, padding: "4px 8px",
            background: j % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
            borderRadius: RADII.sm / 2,
          }}>
            <span style={{ color: W.gold, flexShrink: 0, fontWeight: 700 }}>•</span>
            <span>{renderInlineFormatting(item)}</span>
          </div>
        ))}
      </div>
    );
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("**") && trimmed.endsWith("**") && !trimmed.includes(":**")) {
      flushList();
      const accent = SECTION_ACCENTS[sectionIdx % SECTION_ACCENTS.length];
      sectionIdx++;
      elements.push(
        <div key={`h-${i}`} style={{
          fontSize: 12, fontWeight: 700, color: W.text,
          marginTop: elements.length > 0 ? 10 : 0, marginBottom: 4,
          paddingLeft: 8, borderLeft: `3px solid ${accent}`,
          letterSpacing: 0.2,
        }}>
          {trimmed.slice(2, -2)}
        </div>
      );
      continue;
    }

    const headerMatch = trimmed.match(/^\*\*(.+?):\*\*\s*(.*)/);
    if (headerMatch) {
      flushList();
      const accent = SECTION_ACCENTS[sectionIdx % SECTION_ACCENTS.length];
      sectionIdx++;
      elements.push(
        <div key={`kv-${i}`} style={{
          marginTop: elements.length > 0 ? 8 : 0, marginBottom: 2,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: W.text,
            paddingLeft: 8, borderLeft: `3px solid ${accent}`,
            marginBottom: 3,
          }}>
            {headerMatch[1]}
          </div>
          {headerMatch[2] && (
            <div style={{ fontSize: 12, color: W.textSecondary, paddingLeft: 11, lineHeight: 1.5 }}>
              {renderInlineFormatting(headerMatch[2])}
            </div>
          )}
        </div>
      );
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || /^\d+\.\s/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-•]\s+/, "").replace(/^\d+\.\s+/, "");
      listItems.push(itemText);
      continue;
    }

    flushList();
    elements.push(
      <div key={`p-${i}`} style={{
        fontSize: 12, color: W.textSecondary, lineHeight: 1.6,
        margin: "2px 0",
      }}>
        {renderInlineFormatting(trimmed)}
      </div>
    );
  }

  flushList();
  return <>{elements}</>;
}

function renderInlineFormatting(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) {
      parts.push(<strong key={match.index} style={{ color: W.text, fontWeight: 600 }}>{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(
        <code key={match.index} style={{
          background: "rgba(196,160,80,0.1)", color: W.gold,
          padding: "1px 5px", borderRadius: 4, fontSize: 11,
          fontFamily: "monospace",
        }}>{match[2]}</code>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function WidgetChat({ token }: { token: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry, I could not respond." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [messages, sending, token]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const assistantMsgStyle = (idx: number): CSSProperties => {
    const tints = [
      "rgba(255,255,255,0.02)",
      "rgba(196,160,80,0.02)",
      "rgba(79,110,247,0.02)",
    ];
    return {
      ...glassCardStyle(),
      background: tints[idx % tints.length],
      borderColor: idx % 2 === 0 ? W.border : "rgba(196,160,80,0.08)",
      boxShadow: SHADOWS.card,
      padding: "12px 14px",
      maxWidth: "90%",
      borderRadius: RADII.md,
    };
  };

  let assistantIdx = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto", padding: 16,
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  maxWidth: "85%", padding: "10px 14px", borderRadius: RADII.md,
                  fontSize: 13, lineHeight: 1.5,
                  background: "rgba(196,160,80,0.08)",
                  border: "1px solid rgba(196,160,80,0.12)",
                  color: W.text,
                }}>
                  {msg.content}
                </div>
              </div>
            );
          }

          const aIdx = assistantIdx++;
          return (
            <div key={i} style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={assistantMsgStyle(aIdx)}>
                {renderAiContent(msg.content)}
              </div>
            </div>
          );
        })}

        {messages.length === 1 && !sending && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, justifyContent: "center" }}>
            {CHIPS.map((chip, i) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                style={{
                  background: "rgba(196,160,80,0.08)",
                  border: "1px solid rgba(196,160,80,0.2)",
                  color: W.gold, fontSize: 12, fontWeight: 600,
                  padding: "8px 18px", borderRadius: RADII.full,
                  cursor: "pointer", transition: "all 0.3s",
                  animation: `chipGlow 2.5s ease-in-out ${i * 0.3}s infinite`,
                  boxShadow: "0 0 8px rgba(196,160,80,0.1)",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              ...glassCardStyle(), padding: "10px 18px",
              display: "flex", gap: 4, alignItems: "center",
            }}>
              {[0, 1, 2].map((dot) => (
                <div key={dot} style={{
                  width: 6, height: 6, borderRadius: "50%", background: W.gold,
                  animation: `dotPulse 1.4s ease-in-out ${dot * 0.16}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{
        padding: "10px 16px 14px",
        borderTop: `1px solid ${W.border}`,
        display: "flex", gap: 8, alignItems: "flex-end",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the widget..."
          rows={1}
          style={{
            ...inputStyle(),
            flex: 1, resize: "none",
            maxHeight: 80, minHeight: 40,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || sending}
          style={{
            ...goldButtonStyle(!input.trim() || sending),
            width: 40, height: 40, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, borderRadius: RADII.sm + 2,
          }}
        >
          ↑
        </button>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes chipGlow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(196,160,80,0.1);
            border-color: rgba(196,160,80,0.2);
            background: rgba(196,160,80,0.08);
          }
          50% {
            box-shadow: 0 0 16px rgba(196,160,80,0.3), 0 0 4px rgba(196,160,80,0.15) inset;
            border-color: rgba(196,160,80,0.4);
            background: rgba(196,160,80,0.14);
          }
        }
      `}</style>
    </div>
  );
}
