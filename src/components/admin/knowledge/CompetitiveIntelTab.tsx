"use client";

import { useState, useEffect } from "react";

interface Report {
  filename: string;
  date: string;
  content: string;
}

function renderMarkdown(md: string) {
  return md.split("\n").map((line, i) => {
    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-[var(--app-text)] mt-6 mb-2 font-display">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-brand-gold mt-5 mb-2 font-display">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-[var(--app-text)] mt-4 mb-1.5">{line.slice(4)}</h3>;
    if (line.startsWith("---")) return <hr key={i} className="border-[var(--app-border)] my-4" />;
    if (line.startsWith("- **")) {
      const match = line.match(/^- \*\*(.+?)\*\*[:\s]*(.*)$/);
      if (match) return <div key={i} className="flex gap-2 py-1 pl-4"><span className="font-semibold text-[var(--app-text)] shrink-0">{match[1]}:</span><span className="text-[var(--app-text-secondary)]">{match[2]}</span></div>;
    }
    if (line.startsWith("- ")) return <div key={i} className="py-0.5 pl-4 text-[var(--app-text-secondary)] text-sm">• {line.slice(2)}</div>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-[var(--app-text)] mt-2 mb-1">{line.replace(/\*\*/g, "")}</p>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-[var(--app-text-secondary)] leading-relaxed">{line}</p>;
  });
}

export default function CompetitiveIntelTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const loadReports = () => {
    fetch("/api/admin/competitive-intel")
      .then((r) => r.json())
      .then((d) => { setReports(d.reports || []); setSelectedIdx(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReports(); }, []);

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/admin/competitive-intel/scan", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setScanResult(`Error: ${data.error}`);
      } else {
        setScanResult(`Scan complete — ${data.resultsFound} results across ${data.queriesRun} queries.`);
        loadReports();
      }
    } catch {
      setScanResult("Failed to run competitive scan.");
    }
    setScanning(false);
  }

  if (loading) return <div className="text-center py-12 text-[var(--app-text-muted)]">Loading reports...</div>;
  if (reports.length === 0) return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-[var(--app-text)]">Competitive Intel Scanner</h3>
            <p className="text-sm text-[var(--app-text-muted)] mt-1">Searches the web for competing tariff refund services and recovery tools.</p>
          </div>
          <button onClick={runScan} disabled={scanning} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-brand-gold text-black hover:bg-brand-gold/90 disabled:opacity-40 transition-colors whitespace-nowrap min-h-[44px]">
            {scanning ? "Scanning..." : "Run Scan Now"}
          </button>
        </div>
        {scanResult && (
          <div className={`mt-3 text-sm px-4 py-2.5 rounded-lg ${scanResult.startsWith("Error") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>{scanResult}</div>
        )}
      </div>
      <div className="text-center py-8 text-[var(--app-text-muted)]">No competitive intel reports yet. Click &ldquo;Run Scan Now&rdquo; to generate one.</div>
    </div>
  );

  const report = reports[selectedIdx];

  return (
    <div className="space-y-4">
      {/* Run Scan */}
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-[var(--app-text)]">Competitive Intel Scanner</h3>
            <p className="text-sm text-[var(--app-text-muted)] mt-1">
              Searches the web for competing tariff refund services, CAPE filing providers, and recovery tools.
            </p>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-brand-gold text-black hover:bg-brand-gold/90 disabled:opacity-40 transition-colors whitespace-nowrap min-h-[44px]"
          >
            {scanning ? "Scanning..." : "Run Scan Now"}
          </button>
        </div>
        {scanResult && (
          <div className={`mt-3 text-sm px-4 py-2.5 rounded-lg ${
            scanResult.startsWith("Error")
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-green-500/10 text-green-400 border border-green-500/20"
          }`}>
            {scanResult}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--app-text)]">Competitive Intelligence</h2>
          <p className="text-xs text-[var(--app-text-muted)]">{reports.length} report{reports.length !== 1 ? "s" : ""} available</p>
        </div>
        {reports.length > 1 && (
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="text-sm rounded-lg px-3 py-1.5 bg-[var(--app-input-bg)] border border-[var(--app-input-border)] text-[var(--app-text)]"
          >
            {reports.map((r, i) => (
              <option key={r.filename} value={i}>Report — {r.date}</option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 sm:p-8 overflow-y-auto max-h-[70vh]">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--app-border)]">
          <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-lg">🔍</div>
          <div>
            <div className="font-semibold text-[var(--app-text)]">Competitive Intel Scan — {report.date}</div>
            <div className="text-xs text-[var(--app-text-muted)]">Auto-generated by TIE monitoring agent</div>
          </div>
        </div>
        <div className="prose-sm">{renderMarkdown(report.content)}</div>
      </div>
    </div>
  );
}
