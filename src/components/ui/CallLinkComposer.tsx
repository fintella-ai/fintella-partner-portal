"use client";

// Component: CallLinkComposer
// Inline form triggered by an admin clicking "📞 Add Call Link" in the compose area.
// Calls onInsert with a CallMetaInput object when the user confirms; onCancel dismisses.

import { useState } from "react";

export type CallMetaInput = {
  url: string;
  title?: string;
  startsAt?: string;
  durationMins?: number;
  provider?: string;
};

export default function CallLinkComposer({
  onInsert,
  onCancel,
}: {
  onInsert: (meta: CallMetaInput) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMins, setDurationMins] = useState("");
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);

  const insert = () => {
    if (!url) { setError("URL required"); return; }
    let parsed: URL;
    try { parsed = new URL(url); } catch { setError("URL must be a valid URL"); return; }
    if (parsed.protocol !== "https:") { setError("URL must use https"); return; }
    if (parsed.username || parsed.password) { setError("URL must not contain credentials"); return; }

    const meta: CallMetaInput = { url };
    if (title.trim()) meta.title = title.trim();
    if (startsAt) meta.startsAt = new Date(startsAt).toISOString();
    if (durationMins.trim()) {
      const n = parseInt(durationMins, 10);
      if (Number.isNaN(n) || n <= 0 || n > 1440) { setError("Duration must be 1–1440 mins"); return; }
      meta.durationMins = n;
    }
    if (provider.trim()) meta.provider = provider.trim();
    setError(null);
    onInsert(meta);
  };

  return (
    <div className="theme-card p-3 space-y-2 border-l-4 border-[var(--app-accent,#3b82f6)]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">📞 Add call link</div>
        <button type="button" onClick={onCancel} className="text-xs opacity-70 hover:opacity-100">Cancel</button>
      </div>
      <input
        className="theme-input w-full text-sm"
        placeholder="https://zoom.us/j/123… (required, https only)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        className="theme-input w-full text-sm"
        placeholder="Title (optional, e.g. Weekly L1 sync)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="datetime-local"
          className="theme-input text-sm"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={1440}
          className="theme-input text-sm"
          placeholder="Duration (mins)"
          value={durationMins}
          onChange={(e) => setDurationMins(e.target.value)}
        />
      </div>
      <input
        className="theme-input w-full text-sm"
        placeholder="Provider (optional, e.g. Google Meet)"
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
      />
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={insert}
          className="theme-btn-primary text-sm px-3 py-1.5"
        >
          Insert
        </button>
      </div>
    </div>
  );
}
