"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TICKET_CATEGORIES } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Deal {
  id: string;
  dealName: string;
}

interface Props {
  prefillSubject?: string;
  prefillCategory?: string;
  prefillDescription?: string;
  prefillPriority?: string;
  prefillDealId?: string;
  onCreated: (ticketId: string) => void;
  onCancel: () => void;
}

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function InlineTicketForm({
  prefillSubject = "",
  prefillCategory = "",
  prefillDescription = "",
  prefillPriority = "normal",
  prefillDealId = "",
  onCreated,
  onCancel,
}: Props) {
  const [subject, setSubject] = useState(prefillSubject);
  const [category, setCategory] = useState(prefillCategory);
  const [priority, setPriority] = useState(prefillPriority);
  const [description, setDescription] = useState(prefillDescription);
  const [dealId, setDealId] = useState(prefillDealId);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch partner deals on mount
  useEffect(() => {
    fetch("/api/deals")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.directDeals) {
          setDeals(
            data.directDeals.map((d: { id: string; dealName: string }) => ({
              id: d.id,
              dealName: d.dealName,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!subject.trim() || !category || !description.trim()) {
      setError("Subject, category, and description are required.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const body: Record<string, string> = {
        subject: subject.trim(),
        category,
        message: [
          description.trim(),
          dealId ? `\n\nDeal ID: ${dealId}` : "",
        ]
          .filter(Boolean)
          .join(""),
      };

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedId(data.ticket?.id ?? "");
        onCreated(data.ticket?.id ?? "");
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to create ticket. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success state ─────────────────────────────────────────────────────────
  if (createdId) {
    return (
      <div
        className="mx-2 mb-2 rounded-xl border px-4 py-4"
        style={{
          background: "var(--app-card-bg)",
          borderColor: "var(--app-border)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-400 text-base">&#10003;</span>
          <span className="font-body text-[13px] font-semibold text-[var(--app-text)]">
            Ticket created!
          </span>
        </div>
        <p className="font-body text-[12px] text-[var(--app-text-secondary)] mb-3">
          Your support ticket has been submitted. Our team will respond shortly.
        </p>
        <Link
          href="/dashboard/support"
          className="font-body text-[11px] text-brand-gold hover:text-brand-gold/80 transition-colors underline underline-offset-2"
        >
          View in Support Center &rarr;
        </Link>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="mx-2 mb-2 rounded-xl border overflow-hidden"
      style={{
        background: "var(--app-card-bg)",
        borderColor: "var(--app-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--app-border)]">
        <span className="font-body text-[12px] font-semibold text-[var(--app-text)]">
          Create Support Ticket
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="font-body text-[10px] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] transition-colors"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
        {/* Subject */}
        <div>
          <label className="font-body text-[10px] tracking-[0.5px] uppercase text-[var(--app-text-secondary)] mb-1 block">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description..."
            className="w-full bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2 text-[var(--app-text)] font-body text-[12px] outline-none focus:border-brand-gold/40 transition-colors placeholder:text-[var(--app-text-muted)]"
          />
        </div>

        {/* Category + Priority row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-body text-[10px] tracking-[0.5px] uppercase text-[var(--app-text-secondary)] mb-1 block">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2 text-[var(--app-text)] font-body text-[12px] outline-none focus:border-brand-gold/40 transition-colors"
            >
              <option value="">Select...</option>
              {TICKET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-body text-[10px] tracking-[0.5px] uppercase text-[var(--app-text-secondary)] mb-1 block">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2 text-[var(--app-text)] font-body text-[12px] outline-none focus:border-brand-gold/40 transition-colors"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Related Deal (optional) */}
        {deals.length > 0 && (
          <div>
            <label className="font-body text-[10px] tracking-[0.5px] uppercase text-[var(--app-text-secondary)] mb-1 block">
              Related Deal (optional)
            </label>
            <select
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              className="w-full bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2 text-[var(--app-text)] font-body text-[12px] outline-none focus:border-brand-gold/40 transition-colors"
            >
              <option value="">Select a deal...</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dealName} ({d.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="font-body text-[10px] tracking-[0.5px] uppercase text-[var(--app-text-secondary)] mb-1 block">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue..."
            rows={3}
            className="w-full bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2 text-[var(--app-text)] font-body text-[12px] outline-none focus:border-brand-gold/40 transition-colors placeholder:text-[var(--app-text-muted)] resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="font-body text-[11px] text-red-400">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-gold/20 text-brand-gold border border-brand-gold/30 rounded-lg py-2 font-body text-[12px] font-semibold hover:bg-brand-gold/30 transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Submit Ticket"}
        </button>

        {/* Link to full support page */}
        <div className="text-center">
          <Link
            href="/dashboard/support"
            className="font-body text-[11px] text-[var(--app-text-muted)] hover:text-brand-gold transition-colors"
          >
            Or visit the full Support page &rarr;
          </Link>
        </div>
      </form>
    </div>
  );
}
