"use client";

import { useState } from "react";
import KnowledgeTable from "@/components/admin/knowledge/KnowledgeTable";
import AddKnowledgeForm from "@/components/admin/knowledge/AddKnowledgeForm";
import PendingApprovalCard from "@/components/admin/knowledge/PendingApprovalCard";
import ResearchJobHistory from "@/components/admin/knowledge/ResearchJobHistory";
import KnowledgeAnalytics from "@/components/admin/knowledge/KnowledgeAnalytics";

const TABS = [
  { id: "knowledge", label: "Knowledge Base" },
  { id: "add", label: "Add New" },
  { id: "research", label: "Research Agent" },
  { id: "analytics", label: "Analytics" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function KnowledgeCenterPage() {
  const [tab, setTab] = useState<TabId>("knowledge");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--app-text)]">Knowledge Center</h1>
        <p className="text-sm text-[var(--app-text-muted)] mt-1">
          Manage AI knowledge base, research pipeline, and content approvals
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--app-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "text-brand-gold border-brand-gold"
                : "text-[var(--app-text-muted)] border-transparent hover:text-[var(--app-text-secondary)] hover:border-[var(--app-border)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "knowledge" && <KnowledgeTable key={refreshKey} />}
      {tab === "add" && <AddKnowledgeForm onSaved={refresh} />}
      {tab === "research" && (
        <div className="space-y-8">
          <PendingApprovalCard onAction={refresh} />
          <ResearchJobHistory />
        </div>
      )}
      {tab === "analytics" && <KnowledgeAnalytics />}
    </div>
  );
}
