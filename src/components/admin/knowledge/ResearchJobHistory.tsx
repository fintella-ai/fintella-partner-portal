"use client";

import { useState, useEffect } from "react";

interface ResearchJob {
  id: string;
  status: string;
  query: string;
  resultsFound: number;
  entriesCreated: number;
  runAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400",
  RUNNING: "bg-blue-500/10 text-blue-400",
  COMPLETED: "bg-green-500/10 text-green-400",
  FAILED: "bg-red-500/10 text-red-400",
};

export default function ResearchJobHistory() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/research/jobs")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((data) => setJobs(data.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--app-text)] mb-3">Research Job History</h3>

      {loading ? (
        <div className="text-sm text-[var(--app-text-muted)] py-6 text-center">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-8 text-center">
          <p className="text-sm text-[var(--app-text-muted)]">
            No research jobs have run yet. Use the button above to trigger the first cycle.
          </p>
        </div>
      ) : (
        <div className="border border-[var(--app-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)] text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Query</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Results</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-[var(--app-border)] hover:bg-[var(--app-hover)] transition-colors">
                  <td className="px-4 py-3 text-[var(--app-text-secondary)] whitespace-nowrap">
                    {new Date(job.runAt).toLocaleDateString()}{" "}
                    <span className="text-xs text-[var(--app-text-muted)]">
                      {new Date(job.runAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-[var(--app-text-muted)] line-clamp-1">{job.query}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[job.status] || STATUS_COLORS.PENDING}`}>
                      {job.status}
                    </span>
                    {job.errorMessage && (
                      <div className="text-xs text-red-400 mt-1 line-clamp-1" title={job.errorMessage}>
                        {job.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--app-text-secondary)] hidden md:table-cell">
                    {job.resultsFound}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--app-text-secondary)] hidden md:table-cell">
                    {job.entriesCreated}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
