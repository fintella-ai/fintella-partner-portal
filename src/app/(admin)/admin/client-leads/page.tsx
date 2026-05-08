"use client";

import { Suspense, useState } from "react";
import ClientSubmissionsTab from "../internal-leads/ClientSubmissionsTab";
import MeetingsTab from "../internal-leads/MeetingsTab";

export default function ClientLeadsPage() {
  const [tab, setTab] = useState<"submissions" | "meetings">("submissions");

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-xl font-bold">Client Leads</h2>
          <p className="font-body text-[13px] text-[var(--app-text-muted)] mt-1">
            Direct client submissions from /recover and marketing — tracks deal stages and conversion KPIs.
          </p>
        </div>
        <a
          href="/recover"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-[var(--brand-gold)] text-[var(--app-button-gold-text)] text-sm font-semibold hover:opacity-90 self-start"
        >
          /recover ↗
        </a>
      </div>

      {/* Top-level tabs */}
      <div className="mb-6 border-b border-[var(--app-border)]">
        <div className="flex gap-1">
          {([
            { value: "submissions" as const, label: "Submissions" },
            { value: "meetings" as const, label: "Meetings" },
          ]).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`font-body text-[13px] px-4 py-2.5 rounded-t-lg border border-b-0 transition-colors whitespace-nowrap ${
                tab === t.value
                  ? "text-brand-gold border-[var(--app-border)] bg-[var(--app-card-bg)] -mb-px font-semibold"
                  : "text-[var(--app-text-muted)] border-transparent hover:text-[var(--app-text-secondary)] hover:bg-brand-gold/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Suspense>
        {tab === "submissions" ? <ClientSubmissionsTab /> : <MeetingsTab />}
      </Suspense>
    </div>
  );
}
