"use client";

import { useEffect, useState, useCallback } from "react";

interface FieldPrecision { field: string; total: number; correct: number; precision: number }
interface ConfidenceBin { bin: string; count: number; accuracy: number }
interface CalcResult { fixtureId: string; expectedEligibility: string; actualEligibility: string; match: boolean }
interface Run {
  id: string;
  runDate: string;
  totalFixtures: number;
  overallPrecision: number;
  calcAccuracy: number | null;
  fieldPrecision: FieldPrecision[];
  confidenceCalibration: ConfidenceBin[];
  calcResults: CalcResult[] | null;
  mode: string;
  triggeredBy: string | null;
}

const pct = (n: number | null | undefined) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);
const pctColor = (n: number) => (n >= 0.95 ? "#16a34a" : n >= 0.8 ? "#ca8a04" : "#dc2626");

export default function AccuracyKpiPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [fixtureCount, setFixtureCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accuracy-kpi");
    const data = await res.json();
    setRuns(Array.isArray(data.runs) ? data.runs : []);
    setFixtureCount(data.fixtureCount ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runTest() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/admin/accuracy-kpi", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const latest = runs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Accuracy & KPI</h1>
          <p className="font-body text-[13px] text-[var(--app-text-muted)] mt-1">
            Scores the {fixtureCount} labeled fixtures through document extraction + the tariff calculator:
            per-field precision, confidence calibration, and eligibility accuracy — with drift over time.
          </p>
        </div>
        <button
          onClick={runTest}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-[var(--brand-gold)] text-[var(--app-button-gold-text)] text-sm font-semibold hover:opacity-90 self-start disabled:opacity-50"
        >
          {running ? "Running…" : "Run accuracy test"}
        </button>
      </div>

      {error && <div className="text-sm text-[#dc2626]">{error}</div>}

      {loading ? (
        <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">Loading…</div>
      ) : !latest ? (
        <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">
          No runs yet — click “Run accuracy test” to score the fixtures.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Field precision" value={pct(latest.overallPrecision)} color={pctColor(latest.overallPrecision)} />
            <Stat label="Eligibility accuracy" value={pct(latest.calcAccuracy)} color={latest.calcAccuracy != null ? pctColor(latest.calcAccuracy) : undefined} />
            <Stat label="Fixtures" value={String(latest.totalFixtures)} />
            <Stat label="Last run" value={new Date(latest.runDate).toLocaleString()} />
          </div>

          <Section title="Per-field precision">
            <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)] text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Field</th>
                    <th className="text-right px-3 py-2">Correct / total</th>
                    <th className="text-right px-3 py-2">Precision</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.fieldPrecision.map((f) => (
                    <tr key={f.field} className="border-t border-[var(--app-border)]">
                      <td className="px-3 py-2 font-medium">{f.field}</td>
                      <td className="px-3 py-2 text-right text-[var(--app-text-muted)]">{f.correct} / {f.total}</td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: pctColor(f.precision) }}>{pct(f.precision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Confidence calibration">
            <div className="flex flex-wrap gap-2">
              {latest.confidenceCalibration.filter((b) => b.count > 0).map((b) => (
                <div key={b.bin} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs">
                  <div className="text-[var(--app-text-muted)]">conf {b.bin}</div>
                  <div className="font-semibold" style={{ color: pctColor(b.accuracy) }}>{pct(b.accuracy)} acc</div>
                  <div className="text-[var(--app-text-muted)]">n={b.count}</div>
                </div>
              ))}
            </div>
          </Section>

          {latest.calcResults && latest.calcResults.length > 0 && (
            <Section title="Eligibility checks">
              <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)] text-xs">
                    <tr>
                      <th className="text-left px-3 py-2">Fixture</th>
                      <th className="text-left px-3 py-2">Expected</th>
                      <th className="text-left px-3 py-2">Actual</th>
                      <th className="text-right px-3 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.calcResults.map((c) => (
                      <tr key={c.fixtureId} className="border-t border-[var(--app-border)]">
                        <td className="px-3 py-2 font-medium">{c.fixtureId}</td>
                        <td className="px-3 py-2 text-[var(--app-text-muted)]">{c.expectedEligibility}</td>
                        <td className="px-3 py-2 text-[var(--app-text-muted)]">{c.actualEligibility}</td>
                        <td className="px-3 py-2 text-right">{c.match ? "✅" : "❌"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section title="Run history">
            <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)] text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-right px-3 py-2">Field precision</th>
                    <th className="text-right px-3 py-2">Eligibility acc</th>
                    <th className="text-left px-3 py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--app-border)]">
                      <td className="px-3 py-2">{new Date(r.runDate).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{pct(r.overallPrecision)}</td>
                      <td className="px-3 py-2 text-right">{pct(r.calcAccuracy)}</td>
                      <td className="px-3 py-2 text-xs text-[var(--app-text-muted)]">{r.triggeredBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] p-3">
      <div className="text-xs text-[var(--app-text-muted)]">{label}</div>
      <div className="font-semibold mt-0.5" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-base font-bold">{title}</h2>
      {children}
    </div>
  );
}
