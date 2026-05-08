"use client";

import { useState, useEffect, useCallback } from "react";

interface PendingEntry {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  source: string | null;
  tags: string[];
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  CAPE_UPDATE: "bg-blue-500/10 text-blue-400",
  LEGAL_CHANGE: "bg-red-500/10 text-red-400",
  TARIFF_RATE: "bg-purple-500/10 text-purple-400",
  STRATEGY_TIP: "bg-green-500/10 text-green-400",
  COUNTRY_POLICY: "bg-orange-500/10 text-orange-400",
  BROKER_GUIDANCE: "bg-cyan-500/10 text-cyan-400",
  LEGAL_GUIDANCE: "bg-yellow-500/10 text-yellow-400",
  GENERAL: "bg-white/5 text-[var(--app-text-muted)]",
};

const CATEGORY_LABELS: Record<string, string> = {
  CAPE_UPDATE: "CAPE Update",
  LEGAL_CHANGE: "Legal Change",
  TARIFF_RATE: "Tariff Rate",
  STRATEGY_TIP: "Strategy Tip",
  COUNTRY_POLICY: "Country Policy",
  BROKER_GUIDANCE: "Broker Guidance",
  LEGAL_GUIDANCE: "Legal Guidance",
  GENERAL: "General",
};

const DEFAULT_QUERIES = [
  "CAPE IEEPA tariff refund CBP update 2026",
  "IEEPA tariff executive order change customs",
  "ACE portal CAPE system update customs broker filing",
  "Court of International Trade IEEPA tariff ruling 2026",
  "CBP IEEPA duty refund news importers",
  "tariff refund importer eligible HTS Chapter 99 update",
  "CAPE rejection rate CBP automated refund problems",
  "customs broker IEEPA referral commission opportunity",
  "Section 122 tariff surcharge replacement IEEPA",
  "trade compliance CAPE filing deadline protest window",
];

export default function PendingApprovalCard({ onAction }: { onAction?: () => void }) {
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [showQueries, setShowQueries] = useState(false);
  const [queries, setQueries] = useState<string[]>(DEFAULT_QUERIES);
  const [queriesSaving, setQueriesSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/knowledge?approved=false&limit=50");
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json()).then((d) => {
      if (d?.settings?.researchQueries && Array.isArray(d.settings.researchQueries) && d.settings.researchQueries.length > 0) {
        setQueries(d.settings.researchQueries);
      }
    }).catch(() => {});
  }, []);

  async function saveQueries() {
    setQueriesSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researchQueries: queries.filter((q) => q.trim()) }),
      });
    } catch {}
    setQueriesSaving(false);
  }

  async function runResearch() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/research/trigger", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setRunResult(`Error: ${data.error}`);
      } else {
        setRunResult(`Found ${data.resultsFound} results, created ${data.entriesCreated} new entries.`);
        await load();
      }
    } catch {
      setRunResult("Failed to run research cycle.");
    }
    setRunning(false);
  }

  async function approve(id: string) {
    setActing(id);
    await fetch(`/api/admin/knowledge/${id}/approve`, { method: "POST" });
    await load();
    setActing(null);
    onAction?.();
  }

  async function reject(id: string) {
    if (!confirm("Reject and remove this entry?")) return;
    setActing(id);
    await fetch(`/api/admin/knowledge/${id}`, { method: "DELETE" });
    await load();
    setActing(null);
    onAction?.();
  }

  return (
    <div className="space-y-6">
      {/* Run Research button */}
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-[var(--app-text)]">AI Research Agent</h3>
            <p className="text-sm text-[var(--app-text-muted)] mt-1">
              Searches the web using rotating queries. Found articles are added as pending entries for your review.
              <button onClick={() => setShowQueries(!showQueries)} className="ml-2 text-brand-gold hover:underline">
                {showQueries ? "Hide queries" : "Edit queries"}
              </button>
            </p>
          </div>
          <button
            onClick={runResearch}
            disabled={running}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-brand-gold text-black hover:bg-brand-gold/90 disabled:opacity-40 transition-colors whitespace-nowrap min-h-[44px]"
          >
            {running ? "Searching..." : "Run Research Now"}
          </button>
        </div>

        {showQueries && (
          <div className="mt-4 space-y-2">
            <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">Search Queries (one per line, rotates daily)</div>
            {queries.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => { const next = [...queries]; next[i] = e.target.value; setQueries(next); }}
                  className="flex-1 bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-brand-gold/40"
                  placeholder="Search query..."
                />
                <button
                  onClick={() => setQueries(queries.filter((_, j) => j !== i))}
                  className="text-red-400/60 hover:text-red-400 text-sm px-2"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setQueries([...queries, ""])}
                className="font-body text-[11px] text-brand-gold/70 hover:text-brand-gold transition"
              >
                + Add query
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setQueries(DEFAULT_QUERIES)}
                className="font-body text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition"
              >
                Reset to defaults
              </button>
              <button
                onClick={saveQueries}
                disabled={queriesSaving}
                className="font-body text-[11px] bg-brand-gold text-black rounded-lg px-3 py-1.5 font-medium hover:bg-brand-gold/90 disabled:opacity-40 transition"
              >
                {queriesSaving ? "Saving..." : "Save Queries"}
              </button>
            </div>
          </div>
        )}

        {runResult && (
          <div className={`mt-3 text-sm px-4 py-2.5 rounded-lg ${
            runResult.startsWith("Error")
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-green-500/10 text-green-400 border border-green-500/20"
          }`}>
            {runResult}
          </div>
        )}
      </div>

      {/* Pending entries */}
      <div>
        <h3 className="text-base font-semibold text-[var(--app-text)] mb-3">
          Pending Approval ({entries.length})
        </h3>

        {loading ? (
          <div className="text-sm text-[var(--app-text-muted)] py-6 text-center">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-8 text-center">
            <p className="text-sm text-[var(--app-text-muted)]">
              No pending entries. Run the research agent to discover new content.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-[var(--app-text)]">{entry.title}</h4>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.GENERAL}`}>
                        {CATEGORY_LABELS[entry.category] || entry.category}
                      </span>
                    </div>
                    {entry.summary && (
                      <p className="text-sm text-[var(--app-text-secondary)] mt-1.5 line-clamp-3">{entry.summary}</p>
                    )}
                  </div>
                </div>

                {entry.source && entry.source.startsWith("http") && (
                  <a href={entry.source} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-gold hover:underline break-all block">
                    {entry.source}
                  </a>
                )}

                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-brand-gold/10 text-brand-gold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => approve(entry.id)}
                    disabled={acting === entry.id}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-40 transition-colors min-h-[36px]"
                  >
                    {acting === entry.id ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => reject(entry.id)}
                    disabled={acting === entry.id}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 transition-colors min-h-[36px]"
                  >
                    Reject
                  </button>
                  <span className="text-xs text-[var(--app-text-muted)] ml-auto">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
