"use client";

import { useState } from "react";

const CATEGORY_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "CAPE_UPDATE", label: "CAPE Update" },
  { value: "LEGAL_CHANGE", label: "Legal Change" },
  { value: "TARIFF_RATE", label: "Tariff Rate" },
  { value: "STRATEGY_TIP", label: "Strategy Tip" },
  { value: "COUNTRY_POLICY", label: "Country Policy" },
  { value: "BROKER_GUIDANCE", label: "Broker Guidance" },
  { value: "LEGAL_GUIDANCE", label: "Legal Guidance" },
  { value: "GENERAL", label: "General" },
];

interface PreviewResult {
  summary: string;
  category: string;
  tags: string[];
}

export default function AddKnowledgeForm({ onSaved }: { onSaved?: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handlePreview() {
    if (!content.trim()) {
      setError("Content is required for preview");
      return;
    }
    setError("");
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/knowledge/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreview(data);
    } catch (err: any) {
      setError(err?.message || "Preview failed");
    }
    setPreviewing(false);
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: category || undefined,
          source: source.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSuccess("Knowledge entry saved and auto-approved.");
      setTitle("");
      setContent("");
      setCategory("");
      setSource("");
      setPreview(null);
      onSaved?.();
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-6 space-y-5">
        <h2 className="text-lg font-semibold text-[var(--app-text)]">Add Knowledge Entry</h2>
        <p className="text-sm text-[var(--app-text-muted)]">
          Paste content about IEEPA tariffs, CAPE system, broker guidance, or any topic the AI should know.
          The AI will auto-summarize, categorize, and generate vector embeddings for search.
        </p>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-[var(--app-text-muted)] mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. CAPE Phase 2 Filing Deadline Update"
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--app-bg)] border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-brand-gold/50"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-medium text-[var(--app-text-muted)] mb-1.5">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Paste the full content here. Can be a news article, regulation text, strategy guide, or any knowledge the AI should reference when answering partner questions."
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--app-bg)] border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-brand-gold/50 resize-y"
          />
          <div className="text-xs text-[var(--app-text-muted)] mt-1 text-right">
            {content.length.toLocaleString()} characters
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-[var(--app-text-muted)] mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--app-bg)] border border-[var(--app-border)] text-[var(--app-text)]"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Source URL */}
        <div>
          <label className="block text-xs font-medium text-[var(--app-text-muted)] mb-1.5">Source URL (optional)</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--app-bg)] border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-brand-gold/50"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePreview}
            disabled={previewing || !content.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-hover)] disabled:opacity-40 transition-colors min-h-[44px]"
          >
            {previewing ? "Analyzing..." : "AI Preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-brand-gold text-black hover:bg-brand-gold/90 disabled:opacity-40 transition-colors min-h-[44px]"
          >
            {saving ? "Saving..." : "Save to Knowledge Base"}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5">
            {success}
          </div>
        )}
      </div>

      {/* Preview panel */}
      {preview && (
        <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-gold">AI Preview</h3>

          <div>
            <div className="text-xs font-medium text-[var(--app-text-muted)] mb-1">Summary</div>
            <p className="text-sm text-[var(--app-text-secondary)]">{preview.summary}</p>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--app-text-muted)] mb-1">Detected Category</div>
            <span className="inline-block px-2.5 py-1 rounded text-xs font-medium bg-brand-gold/10 text-brand-gold">
              {preview.category}
            </span>
          </div>

          {preview.tags.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--app-text-muted)] mb-1">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {preview.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[var(--app-text-secondary)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
