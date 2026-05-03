"use client";
import { useState, useEffect, useCallback } from "react";

interface TemplateItem {
  id: string;
  key: string;
  name: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  bodyText?: string;
  category: string;
  status: string;
  aiGenerated: boolean;
  variableKeys: string[];
  workflowTags: string[];
  characterCount?: number;
  segmentCount?: number;
  updatedAt: string;
  sharedStatus: string | null; // null | "pending" | "approved" | "rejected"
}

interface MarketplaceItem {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  bodyPreview: string;
  category: string;
  sharedByName: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  conversionRate: number | null;
}

export default function PartnerTemplatesPage() {
  const [tab, setTab] = useState<"my" | "marketplace">("my");
  const [templateType, setTemplateType] = useState<"email" | "sms">("email");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    fetch(`/api/partner/templates?type=${templateType}`)
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [templateType]);

  const fetchMarketplace = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/templates/marketplace?status=approved&sort=downloads")
      .then(r => r.json())
      .then(data => {
        setMarketplace(Array.isArray(data) ? data : []);
      })
      .catch(() => setMarketplace([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "my") fetchTemplates();
    else fetchMarketplace();
  }, [tab, fetchTemplates, fetchMarketplace]);

  async function shareTemplate(templateId: string) {
    setSharing(templateId);
    setShareError(null);
    setShareSuccess(null);

    try {
      const res = await fetch("/api/partner/templates/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, templateType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setShareError(data.error || "Failed to share");
        return;
      }

      setShareSuccess(templateId);
      // Update the local state to reflect the share
      setTemplates(prev =>
        prev.map(t =>
          t.id === templateId ? { ...t, sharedStatus: "pending" } : t
        )
      );

      // Clear success after 3 seconds
      setTimeout(() => setShareSuccess(null), 3000);
    } catch {
      setShareError("Network error");
    } finally {
      setSharing(null);
    }
  }

  function getSharedBadge(status: string | null) {
    if (!status) return null;
    const styles: Record<string, string> = {
      pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      approved: "bg-green-500/10 text-green-400 border-green-500/20",
      rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[status] || ""}`}>
        {status === "pending" && "Pending Review"}
        {status === "approved" && "Live on Marketplace"}
        {status === "rejected" && "Not Approved"}
      </span>
    );
  }

  const previewTemplate = templates.find(t => t.id === previewId);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--app-text)" }}>
          Templates
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--app-text-secondary)" }}>
          Browse templates and share your best ones with the partner network
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: "1px solid var(--app-border)" }}>
        <button
          onClick={() => setTab("my")}
          className="px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderBottom: tab === "my" ? "2px solid var(--app-accent, #3b82f6)" : "2px solid transparent",
            color: tab === "my" ? "var(--app-accent, #3b82f6)" : "var(--app-text-secondary)",
          }}
        >
          My Templates
        </button>
        <button
          onClick={() => setTab("marketplace")}
          className="px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderBottom: tab === "marketplace" ? "2px solid var(--app-accent, #3b82f6)" : "2px solid transparent",
            color: tab === "marketplace" ? "var(--app-accent, #3b82f6)" : "var(--app-text-secondary)",
          }}
        >
          Marketplace
        </button>
      </div>

      {/* My Templates tab */}
      {tab === "my" && (
        <>
          {/* Type toggle */}
          <div className="flex gap-2 mb-5">
            {(["email", "sms"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTemplateType(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: templateType === t ? "var(--app-accent, #3b82f6)" : "var(--app-bg-secondary)",
                  color: templateType === t ? "#fff" : "var(--app-text-secondary)",
                }}
              >
                {t === "email" ? "Email" : "SMS"}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {shareError && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm font-medium"
              style={{ background: "var(--app-error-bg, rgba(239,68,68,0.1))", color: "var(--app-error, #ef4444)", border: "1px solid var(--app-error-border, rgba(239,68,68,0.2))" }}
            >
              {shareError}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-40 rounded-xl animate-pulse"
                  style={{ background: "var(--app-bg-secondary)" }}
                />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div
              className="text-center py-16 rounded-xl"
              style={{ border: "1px dashed var(--app-border)", color: "var(--app-text-secondary)" }}
            >
              <p className="text-base mb-2">No templates available</p>
              <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                Templates will appear here once your admin creates them
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div
                  key={t.id}
                  className="rounded-xl p-4 transition-colors"
                  style={{
                    background: "var(--app-card-bg, var(--app-bg-secondary))",
                    border: "1px solid var(--app-border)",
                  }}
                >
                  {/* Top row: name + badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3
                      className="text-sm font-semibold line-clamp-1"
                      style={{ color: "var(--app-text)" }}
                    >
                      {t.name}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.aiGenerated && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: "rgba(245,158,11,0.1)", color: "rgb(245,158,11)" }}
                        >
                          AI
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          background: t.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                          color: t.status === "active" ? "rgb(34,197,94)" : "rgb(245,158,11)",
                        }}
                      >
                        {t.status}
                      </span>
                    </div>
                  </div>

                  {/* Subject / body preview */}
                  {templateType === "email" && t.subject && (
                    <p className="text-xs line-clamp-1 mb-1.5" style={{ color: "var(--app-text-secondary)" }}>
                      {t.subject}
                    </p>
                  )}
                  {templateType === "sms" && t.body && (
                    <p className="text-xs line-clamp-2 mb-1.5" style={{ color: "var(--app-text-secondary)" }}>
                      {t.body}
                    </p>
                  )}

                  {/* Category + date */}
                  <div className="flex items-center gap-2 text-[10px] mb-3" style={{ color: "var(--app-text-muted)" }}>
                    <span>{t.category}</span>
                    {t.variableKeys.length > 0 && <span>{t.variableKeys.length} vars</span>}
                    <span className="ml-auto">{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Shared status badge */}
                  {t.sharedStatus && (
                    <div className="mb-3">
                      {getSharedBadge(t.sharedStatus)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: "var(--app-bg-secondary)",
                        color: "var(--app-text-secondary)",
                        border: "1px solid var(--app-border)",
                      }}
                    >
                      {previewId === t.id ? "Hide" : "Preview"}
                    </button>

                    {!t.sharedStatus ? (
                      <button
                        onClick={() => shareTemplate(t.id)}
                        disabled={sharing === t.id}
                        className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                        style={{
                          background: shareSuccess === t.id
                            ? "rgba(34,197,94,0.15)"
                            : "var(--app-accent, #3b82f6)",
                          color: shareSuccess === t.id
                            ? "rgb(34,197,94)"
                            : "#fff",
                          border: shareSuccess === t.id
                            ? "1px solid rgba(34,197,94,0.3)"
                            : "none",
                        }}
                      >
                        {sharing === t.id ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sharing...
                          </>
                        ) : shareSuccess === t.id ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Shared!
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Share to Marketplace
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="ml-auto">
                        {getSharedBadge(t.sharedStatus)}
                      </div>
                    )}
                  </div>

                  {/* Inline preview */}
                  {previewId === t.id && (
                    <div
                      className="mt-3 rounded-lg p-3 text-xs max-h-48 overflow-auto whitespace-pre-wrap"
                      style={{
                        background: "var(--app-bg)",
                        border: "1px solid var(--app-border)",
                        color: "var(--app-text-secondary)",
                        fontFamily: "monospace",
                      }}
                    >
                      {templateType === "email"
                        ? (t.bodyText || t.bodyHtml?.replace(/<[^>]*>/g, "") || "No content")
                        : (t.body || "No content")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Marketplace tab */}
      {tab === "marketplace" && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-40 rounded-xl animate-pulse"
                  style={{ background: "var(--app-bg-secondary)" }}
                />
              ))}
            </div>
          ) : marketplace.length === 0 ? (
            <div
              className="text-center py-16 rounded-xl"
              style={{ border: "1px dashed var(--app-border)", color: "var(--app-text-secondary)" }}
            >
              <p className="text-base mb-2">No marketplace templates yet</p>
              <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                Share your templates to be the first on the marketplace
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketplace.map(t => (
                <div
                  key={t.id}
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--app-card-bg, var(--app-bg-secondary))",
                    border: "1px solid var(--app-border)",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold line-clamp-1" style={{ color: "var(--app-text)" }}>
                      {t.name}
                    </h3>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                      style={{
                        background: t.templateType === "email" ? "rgba(59,130,246,0.1)" : "rgba(34,197,94,0.1)",
                        color: t.templateType === "email" ? "rgb(59,130,246)" : "rgb(34,197,94)",
                      }}
                    >
                      {t.templateType}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--app-text-secondary)" }}>
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs mb-3" style={{ color: "var(--app-text-muted)" }}>
                    <span>
                      {"★".repeat(Math.round(t.rating))}{"☆".repeat(5 - Math.round(t.rating))}
                      {" "}({t.ratingCount})
                    </span>
                    <span>{t.downloads} downloads</span>
                    {t.conversionRate != null && (
                      <span>{(t.conversionRate * 100).toFixed(1)}% conv</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--app-text-muted)" }}>
                      by {t.sharedByName}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: "var(--app-bg-secondary)", color: "var(--app-text-secondary)" }}
                    >
                      {t.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
