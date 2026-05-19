"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DEFAULT_RECOVER, DEFAULT_PARTNERS, DEFAULT_BROKERS, DEFAULT_WEBINAR,
  parsePageContent,
  type RecoverPageContent, type PartnersPageContent, type WebinarPageContent,
} from "@/lib/landingPageSchemas";

// ─── Types ────────────────────────────────────────────────────────────────────

type PageSlug = "recover" | "partners" | "brokers" | "webinar";

interface SectionDef {
  id: string;
  label: string;
  icon: string;
  preview: (draft: any) => string;
}

interface PageRow {
  slug: string;
  label: string;
  draft: string;
  published: string;
  enabled: boolean;
  lastPublishedAt: string | null;
}

// ─── Page config ──────────────────────────────────────────────────────────────

const PAGE_TABS: { slug: PageSlug; label: string; route: string }[] = [
  { slug: "recover",  label: "Client Recovery",    route: "/recover" },
  { slug: "partners", label: "Partner Recruitment", route: "/partners" },
  { slug: "brokers",  label: "Customs Brokers",     route: "/partners/brokers" },
  { slug: "webinar",  label: "Webinar Funnel",      route: "/webinar" },
];

const RECOVER_SECTIONS: SectionDef[] = [
  { id: "hero",       label: "Hero",          icon: "🏆", preview: (d) => d?.hero?.headline || "Hero section" },
  { id: "howItWorks", label: "How It Works",  icon: "⚙️", preview: (d) => d?.howItWorks?.title || "How It Works" },
  { id: "resources",  label: "Resources",     icon: "📚", preview: (d) => d?.resources?.title || "Resources" },
  { id: "footer",     label: "Footer",        icon: "📄", preview: (d) => d?.footer?.copyright || "Footer" },
];

const PARTNERS_SECTIONS: SectionDef[] = [
  { id: "hero",       label: "Hero",          icon: "🏆", preview: (d) => d?.hero?.headline || "Hero section" },
  { id: "howItWorks", label: "How It Works",  icon: "⚙️", preview: (d) => d?.howItWorks?.title || "How It Works" },
  { id: "whyPartner", label: "Why Partner",   icon: "🤝", preview: (d) => d?.whyPartner?.title || "Why Partner" },
  { id: "opportunity",label: "Opportunity",   icon: "💰", preview: (d) => d?.opportunity?.title || "Opportunity" },
  { id: "faq",        label: "FAQ",           icon: "❓", preview: (d) => `${d?.faq?.items?.length ?? 0} questions` },
  { id: "bottomCta",  label: "Bottom CTA",    icon: "🎯", preview: (d) => d?.bottomCta?.title || "Call to Action" },
  { id: "footer",     label: "Footer",        icon: "📄", preview: (d) => d?.footer?.copyright || "Footer" },
];

const WEBINAR_SECTIONS: SectionDef[] = [
  { id: "hero",      label: "Squeeze Page",  icon: "📺", preview: (d) => d?.hero?.headline || "Squeeze Page" },
  { id: "watchPage", label: "Watch Page",    icon: "▶️", preview: (d) => d?.watchPage?.welcomeHeading || "Watch Page" },
  { id: "takeaways", label: "Takeaways",     icon: "✅", preview: (d) => `${d?.takeaways?.length ?? 0} takeaways` },
  { id: "footer",    label: "Footer",        icon: "📄", preview: (d) => d?.footer?.copyright || "Footer" },
];

function getSections(slug: PageSlug): SectionDef[] {
  if (slug === "recover") return RECOVER_SECTIONS;
  if (slug === "webinar") return WEBINAR_SECTIONS;
  return PARTNERS_SECTIONS;
}

function getDraftContent(slug: PageSlug, raw: string) {
  if (slug === "recover") return parsePageContent(raw, DEFAULT_RECOVER);
  if (slug === "brokers")  return parsePageContent(raw, DEFAULT_BROKERS);
  if (slug === "webinar")  return parsePageContent(raw, DEFAULT_WEBINAR);
  return parsePageContent(raw, DEFAULT_PARTNERS);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LandingPagesEditor() {
  const [activeSlug, setActiveSlug] = useState<PageSlug>("recover");
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>("hero");
  const [sectionOrder, setSectionOrder] = useState<Record<PageSlug, string[]>>({
    recover: RECOVER_SECTIONS.map((s) => s.id),
    partners: PARTNERS_SECTIONS.map((s) => s.id),
    brokers: PARTNERS_SECTIONS.map((s) => s.id),
    webinar: WEBINAR_SECTIONS.map((s) => s.id),
  });

  // DnD state
  const dragSrc = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/landing-pages");
      if (res.ok) {
        const data: PageRow[] = await res.json();
        setPages(data);
        // Restore saved section order from draft JSON
        const newOrder = { ...sectionOrder };
        for (const page of data) {
          try {
            const parsed = JSON.parse(page.draft || "{}");
            if (parsed._sectionOrder && Array.isArray(parsed._sectionOrder)) {
              const slug = page.slug as PageSlug;
              const defaults = getSections(slug).map((s) => s.id);
              const valid = (parsed._sectionOrder as string[]).filter((id) => defaults.includes(id));
              const missing = defaults.filter((id) => !valid.includes(id));
              newOrder[slug] = [...valid, ...missing];
            }
          } catch { /* ignore */ }
        }
        setSectionOrder(newOrder);
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function flash(tone: "ok" | "err", msg: string) {
    setBanner({ tone, msg });
    setTimeout(() => setBanner(null), 4000);
  }

  const activePage = pages.find((p) => p.slug === activeSlug);
  const activeTab = PAGE_TABS.find((t) => t.slug === activeSlug)!;
  const sections = getSections(activeSlug);
  const orderedSections = sectionOrder[activeSlug].map((id) => sections.find((s) => s.id === id)!).filter(Boolean);

  function getDraft() {
    return getDraftContent(activeSlug, activePage?.draft || "{}");
  }

  function setDraft(content: any) {
    const withOrder = { ...content, _sectionOrder: sectionOrder[activeSlug] };
    setPages((prev) =>
      prev.map((p) => p.slug === activeSlug ? { ...p, draft: JSON.stringify(withOrder) } : p)
    );
  }

  function switchPage(slug: PageSlug) {
    setActiveSlug(slug);
    setExpandedSection("hero");
  }

  async function saveDraft() {
    if (!activePage) return;
    setSaving(true);
    try {
      const draftWithOrder = (() => {
        try {
          const parsed = JSON.parse(activePage.draft || "{}");
          return JSON.stringify({ ...parsed, _sectionOrder: sectionOrder[activeSlug] });
        } catch { return activePage.draft; }
      })();
      const res = await fetch("/api/admin/landing-pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: activeSlug, draft: draftWithOrder }),
      });
      if (res.ok) flash("ok", "Draft saved");
      else flash("err", "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!confirm(`Publish ${activeTab.label}? This makes the draft content live at ${activeTab.route}.`)) return;
    setPublishing(true);
    try {
      await saveDraft();
      const res = await fetch("/api/admin/landing-pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: activeSlug, publish: true }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPages((prev) =>
          prev.map((p) => p.slug === activeSlug ? { ...p, published: updated.published, lastPublishedAt: updated.lastPublishedAt } : p)
        );
        flash("ok", "Published! Changes are live.");
      } else flash("err", "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  // ─── Drag-and-drop handlers ──────────────────────────────────────────────

  function onDragStart(idx: number) {
    dragSrc.current = idx;
  }

  function onDragEnter(idx: number) {
    setDragOver(idx);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(dropIdx: number) {
    const srcIdx = dragSrc.current;
    if (srcIdx === null || srcIdx === dropIdx) { cleanup(); return; }
    const next = [...sectionOrder[activeSlug]];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(dropIdx, 0, moved);
    setSectionOrder((prev) => ({ ...prev, [activeSlug]: next }));
    // Persist order in draft
    setPages((prev) =>
      prev.map((p) => {
        if (p.slug !== activeSlug) return p;
        try {
          const parsed = JSON.parse(p.draft || "{}");
          return { ...p, draft: JSON.stringify({ ...parsed, _sectionOrder: next }) };
        } catch { return p; }
      })
    );
    cleanup();
  }

  function cleanup() {
    dragSrc.current = null;
    setDragOver(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="spinner" />
      </div>
    );
  }

  const draft = getDraft();

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Landing Pages</h1>
          <p className="font-body text-[12px] theme-text-muted mt-0.5">
            Edit public-facing pages. Drag sections to reorder.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="font-body text-[11px] theme-text-muted">
            {activePage?.lastPublishedAt
              ? `Published ${new Date(activePage.lastPublishedAt).toLocaleDateString()}`
              : "Never published"}
          </span>
          <a
            href={activeTab.route}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg border border-[var(--app-border)] font-body text-[12px] hover:bg-[var(--app-hover)] transition"
          >
            View live ↗
          </a>
          <button
            onClick={saveDraft}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-[var(--app-border)] font-body text-[12px] hover:bg-[var(--app-hover)] transition"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={publish}
            disabled={publishing}
            className="px-3 py-1.5 rounded-lg font-body text-[12px] font-semibold bg-[var(--brand-gold)] text-[var(--app-button-gold-text)] hover:opacity-90 transition"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {banner && (
        <div className={`px-4 py-2.5 rounded-lg border font-body text-[13px] mb-3 ${
          banner.tone === "ok"
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          {banner.msg}
        </div>
      )}

      {/* ── Page tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-[var(--app-border)] mb-5 overflow-x-auto">
        {PAGE_TABS.map((t) => (
          <button
            key={t.slug}
            onClick={() => switchPage(t.slug)}
            className={`px-4 py-2 font-body text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
              activeSlug === t.slug
                ? "border-[var(--brand-gold)] text-[var(--app-text)]"
                : "border-transparent theme-text-muted hover:text-[var(--app-text)]"
            }`}
          >
            {t.label}
            <span className="font-body text-[10px] theme-text-muted ml-1.5 hidden sm:inline">{t.route}</span>
          </button>
        ))}
      </div>

      {/* ── Two-column builder ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 flex-1">

        {/* Left: section block list */}
        <div className="space-y-1">
          <div className="font-body text-[10px] uppercase tracking-[1.5px] theme-text-muted mb-2 px-1">
            Sections — drag to reorder
          </div>
          {orderedSections.map((section, idx) => {
            const isActive = expandedSection === section.id;
            const isDragTarget = dragOver === idx;
            const previewText = section.preview(draft);

            return (
              <div
                key={section.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(idx)}
                onDragEnd={cleanup}
                onClick={() => setExpandedSection(section.id)}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition
                  ${isActive
                    ? "bg-[var(--brand-gold)]/10 border border-[var(--brand-gold)]/30"
                    : "border border-transparent hover:border-[var(--app-border)] hover:bg-[var(--app-hover)]"}
                  ${isDragTarget ? "border-[var(--brand-gold)] bg-[var(--brand-gold)]/5 scale-[1.01]" : ""}
                `}
              >
                {/* Drag handle */}
                <span
                  className="text-[var(--app-text-muted)] cursor-grab active:cursor-grabbing select-none shrink-0"
                  style={{ fontSize: 14, lineHeight: 1 }}
                  title="Drag to reorder"
                >
                  ⠿
                </span>

                {/* Section icon */}
                <span className="text-base shrink-0">{section.icon}</span>

                {/* Label + preview */}
                <div className="min-w-0 flex-1">
                  <div className={`font-body text-[13px] font-medium truncate ${isActive ? "text-[var(--brand-gold)]" : "text-[var(--app-text)]"}`}>
                    {section.label}
                  </div>
                  <div className="font-body text-[10px] theme-text-muted truncate leading-tight mt-0.5">
                    {previewText}
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--brand-gold)]" />
                )}
              </div>
            );
          })}

          {/* Page status */}
          <div className="mt-4 px-1 pt-3 border-t border-[var(--app-border)]">
            <div className="flex items-center justify-between">
              <span className="font-body text-[11px] theme-text-muted">Page status</span>
              <span className={`font-body text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                activePage?.enabled
                  ? "bg-green-500/10 text-green-400"
                  : "bg-gray-500/10 text-gray-400"
              }`}>
                {activePage?.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: section editor */}
        <div className="min-w-0">
          {activeSlug === "recover" && (
            <RecoverSectionEditor
              draft={draft as RecoverPageContent}
              setDraft={setDraft}
              section={expandedSection}
            />
          )}
          {(activeSlug === "partners" || activeSlug === "brokers") && (
            <PartnersSectionEditor
              draft={draft as PartnersPageContent}
              setDraft={setDraft}
              section={expandedSection}
            />
          )}
          {activeSlug === "webinar" && (
            <WebinarSectionEditor
              draft={draft as WebinarPageContent}
              setDraft={setDraft}
              section={expandedSection}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared field components ──────────────────────────────────────────────────

function Field({
  label, value, onChange, rows, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string; hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <div className="font-body text-[11px] uppercase tracking-[1.2px] theme-text-muted">{label}</div>
      {hint && <div className="font-body text-[11px] theme-text-muted -mt-0.5">{hint}</div>}
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full theme-input rounded-xl px-3 py-2 font-body text-[13px]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full theme-input rounded-xl px-3 py-2 font-body text-[13px]"
        />
      )}
    </label>
  );
}

function SectionShell({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--app-border)]">
        <span className="text-lg">{icon}</span>
        <span className="font-display text-[14px] font-semibold">{label}</span>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function ArrayField<T>({
  label, items, renderItem, onAdd, emptyItem,
}: {
  label: string;
  items: T[];
  renderItem: (item: T, idx: number, setItem: (v: T) => void, remove: () => void) => React.ReactNode;
  onAdd: (next: T[]) => void;
  emptyItem: T;
}) {
  return (
    <div>
      <div className="font-body text-[11px] uppercase tracking-[1.2px] theme-text-muted mb-2">{label}</div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx}>
            {renderItem(
              item,
              idx,
              (v) => { const next = [...items]; next[idx] = v; onAdd(next); },
              () => onAdd(items.filter((_, i) => i !== idx))
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => onAdd([...items, emptyItem])}
        className="mt-2 font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition"
      >
        + Add {label.replace(/s$/, "")}
      </button>
    </div>
  );
}

// ─── Recover section editor ───────────────────────────────────────────────────

function RecoverSectionEditor({
  draft, setDraft, section,
}: { draft: RecoverPageContent; setDraft: (d: RecoverPageContent) => void; section: string }) {
  const h = draft.hero;
  const setHero = (patch: Partial<typeof h>) => setDraft({ ...draft, hero: { ...h, ...patch } });

  if (section === "hero") return (
    <SectionShell label="Hero" icon="🏆">
      <Field label="Badge" value={h.badge} onChange={(v) => setHero({ badge: v })} />
      <Field label="Headline" value={h.headline} onChange={(v) => setHero({ headline: v })} />
      <Field label="Subheadline" value={h.subheadline} onChange={(v) => setHero({ subheadline: v })} rows={3} />
      <ArrayField
        label="Bullets"
        items={h.bullets}
        emptyItem=""
        onAdd={(next) => setHero({ bullets: next })}
        renderItem={(b, _idx, set, remove) => (
          <div className="flex gap-2">
            <input value={b} onChange={(e) => set(e.target.value)} className="flex-1 theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
            <button onClick={remove} className="font-body text-[11px] text-red-400 px-2 hover:text-red-300">✕</button>
          </div>
        )}
      />
      <div>
        <div className="font-body text-[11px] uppercase tracking-[1.2px] theme-text-muted mb-2">Stats</div>
        <div className="space-y-2">
          {h.stats.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input value={s.value} onChange={(e) => { const next = [...h.stats]; next[i] = { ...s, value: e.target.value }; setHero({ stats: next }); }} placeholder="Value e.g. $166B" className="theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
              <input value={s.label} onChange={(e) => { const next = [...h.stats]; next[i] = { ...s, label: e.target.value }; setHero({ stats: next }); }} placeholder="Label e.g. Refunds Owed" className="theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );

  if (section === "howItWorks") return (
    <SectionShell label="How It Works" icon="⚙️">
      <Field label="Title" value={draft.howItWorks.title} onChange={(v) => setDraft({ ...draft, howItWorks: { ...draft.howItWorks, title: v } })} />
      <div className="space-y-2">
        {draft.howItWorks.steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
            <div className="font-body text-[11px] font-semibold theme-text-muted">Step {i + 1}</div>
            <Field label="Title" value={s.title} onChange={(v) => { const next = [...draft.howItWorks.steps]; next[i] = { ...s, title: v }; setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: next } }); }} />
            <Field label="Description" value={s.description} onChange={(v) => { const next = [...draft.howItWorks.steps]; next[i] = { ...s, description: v }; setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: next } }); }} rows={2} />
            <button onClick={() => setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: draft.howItWorks.steps.filter((_, ix) => ix !== i) } })} className="font-body text-[11px] text-red-400">Remove step</button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: [...draft.howItWorks.steps, { title: "", description: "" }] } })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add step</button>
      </div>
    </SectionShell>
  );

  if (section === "resources") return (
    <SectionShell label="Resources" icon="📚">
      <Field label="Title" value={draft.resources.title} onChange={(v) => setDraft({ ...draft, resources: { ...draft.resources, title: v } })} />
      <Field label="Subtitle" value={draft.resources.subtitle} onChange={(v) => setDraft({ ...draft, resources: { ...draft.resources, subtitle: v } })} />
      <div className="space-y-2">
        {draft.resources.items.map((r, i) => (
          <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <Field label="Icon" value={r.icon} onChange={(v) => { const next = [...draft.resources.items]; next[i] = { ...r, icon: v }; setDraft({ ...draft, resources: { ...draft.resources, items: next } }); }} />
              <Field label="Title" value={r.title} onChange={(v) => { const next = [...draft.resources.items]; next[i] = { ...r, title: v }; setDraft({ ...draft, resources: { ...draft.resources, items: next } }); }} />
            </div>
            <Field label="Description" value={r.description} onChange={(v) => { const next = [...draft.resources.items]; next[i] = { ...r, description: v }; setDraft({ ...draft, resources: { ...draft.resources, items: next } }); }} rows={2} />
            <Field label="File path" value={r.file} onChange={(v) => { const next = [...draft.resources.items]; next[i] = { ...r, file: v }; setDraft({ ...draft, resources: { ...draft.resources, items: next } }); }} hint="e.g. /resources/guide.pdf" />
            <button onClick={() => setDraft({ ...draft, resources: { ...draft.resources, items: draft.resources.items.filter((_, ix) => ix !== i) } })} className="font-body text-[11px] text-red-400">Remove</button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, resources: { ...draft.resources, items: [...draft.resources.items, { icon: "📄", title: "", description: "", file: "" }] } })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add resource</button>
      </div>
    </SectionShell>
  );

  if (section === "footer") return (
    <SectionShell label="Footer" icon="📄">
      <Field label="Copyright" value={draft.footer.copyright} onChange={(v) => setDraft({ ...draft, footer: { ...draft.footer, copyright: v } })} />
      <Field label="Disclaimer" value={draft.footer.disclaimer} onChange={(v) => setDraft({ ...draft, footer: { ...draft.footer, disclaimer: v } })} rows={3} />
    </SectionShell>
  );

  return null;
}

// ─── Partners / Brokers section editor ───────────────────────────────────────

function PartnersSectionEditor({
  draft, setDraft, section,
}: { draft: PartnersPageContent; setDraft: (d: PartnersPageContent) => void; section: string }) {
  const h = draft.hero;
  const setHero = (patch: Partial<typeof h>) => setDraft({ ...draft, hero: { ...h, ...patch } });

  if (section === "hero") return (
    <SectionShell label="Hero" icon="🏆">
      <Field label="Badge" value={h.badge} onChange={(v) => setHero({ badge: v })} />
      <Field label="Headline" value={h.headline} onChange={(v) => setHero({ headline: v })} />
      <Field label="Subheadline" value={h.subheadline} onChange={(v) => setHero({ subheadline: v })} rows={3} />
      <div>
        <div className="font-body text-[11px] uppercase tracking-[1.2px] theme-text-muted mb-2">Value Props</div>
        <div className="space-y-2">
          {h.bullets.map((b, i) => (
            <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
              <div className="grid grid-cols-[64px_1fr] gap-2">
                <Field label="Icon" value={b.icon} onChange={(v) => { const next = [...h.bullets]; next[i] = { ...b, icon: v }; setHero({ bullets: next }); }} />
                <Field label="Title" value={b.title} onChange={(v) => { const next = [...h.bullets]; next[i] = { ...b, title: v }; setHero({ bullets: next }); }} />
              </div>
              <Field label="Description" value={b.description} onChange={(v) => { const next = [...h.bullets]; next[i] = { ...b, description: v }; setHero({ bullets: next }); }} />
              <button onClick={() => setHero({ bullets: h.bullets.filter((_, ix) => ix !== i) })} className="font-body text-[11px] text-red-400">Remove</button>
            </div>
          ))}
          <button onClick={() => setHero({ bullets: [...h.bullets, { icon: "✨", title: "", description: "" }] })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add value prop</button>
        </div>
      </div>
      <div>
        <div className="font-body text-[11px] uppercase tracking-[1.2px] theme-text-muted mb-2">Stats</div>
        <div className="space-y-2">
          {h.stats.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input value={s.value} onChange={(e) => { const next = [...h.stats]; next[i] = { ...s, value: e.target.value }; setHero({ stats: next }); }} placeholder="Value" className="theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
              <input value={s.label} onChange={(e) => { const next = [...h.stats]; next[i] = { ...s, label: e.target.value }; setHero({ stats: next }); }} placeholder="Label" className="theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );

  if (section === "howItWorks") return (
    <SectionShell label="How It Works" icon="⚙️">
      <Field label="Title" value={draft.howItWorks.title} onChange={(v) => setDraft({ ...draft, howItWorks: { ...draft.howItWorks, title: v } })} />
      <div className="space-y-2">
        {draft.howItWorks.steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
            <div className="font-body text-[11px] font-semibold theme-text-muted">Step {i + 1}</div>
            <Field label="Title" value={s.title} onChange={(v) => { const next = [...draft.howItWorks.steps]; next[i] = { ...s, title: v }; setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: next } }); }} />
            <Field label="Description" value={s.description} onChange={(v) => { const next = [...draft.howItWorks.steps]; next[i] = { ...s, description: v }; setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: next } }); }} rows={2} />
            <button onClick={() => setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: draft.howItWorks.steps.filter((_, ix) => ix !== i) } })} className="font-body text-[11px] text-red-400">Remove step</button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, howItWorks: { ...draft.howItWorks, steps: [...draft.howItWorks.steps, { title: "", description: "" }] } })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add step</button>
      </div>
    </SectionShell>
  );

  if (section === "whyPartner") return (
    <SectionShell label="Why Partner" icon="🤝">
      <Field label="Title" value={draft.whyPartner.title} onChange={(v) => setDraft({ ...draft, whyPartner: { ...draft.whyPartner, title: v } })} />
      <Field label="Subtitle" value={draft.whyPartner.subtitle} onChange={(v) => setDraft({ ...draft, whyPartner: { ...draft.whyPartner, subtitle: v } })} />
      <div className="space-y-2">
        {draft.whyPartner.features.map((f, i) => (
          <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <Field label="Icon" value={f.icon} onChange={(v) => { const next = [...draft.whyPartner.features]; next[i] = { ...f, icon: v }; setDraft({ ...draft, whyPartner: { ...draft.whyPartner, features: next } }); }} />
              <Field label="Title" value={f.title} onChange={(v) => { const next = [...draft.whyPartner.features]; next[i] = { ...f, title: v }; setDraft({ ...draft, whyPartner: { ...draft.whyPartner, features: next } }); }} />
            </div>
            <Field label="Description" value={f.description} onChange={(v) => { const next = [...draft.whyPartner.features]; next[i] = { ...f, description: v }; setDraft({ ...draft, whyPartner: { ...draft.whyPartner, features: next } }); }} rows={2} />
            <button onClick={() => setDraft({ ...draft, whyPartner: { ...draft.whyPartner, features: draft.whyPartner.features.filter((_, ix) => ix !== i) } })} className="font-body text-[11px] text-red-400">Remove</button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, whyPartner: { ...draft.whyPartner, features: [...draft.whyPartner.features, { icon: "✨", title: "", description: "" }] } })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add feature</button>
      </div>
    </SectionShell>
  );

  if (section === "opportunity") return (
    <SectionShell label="Opportunity" icon="💰">
      <Field label="Title" value={draft.opportunity.title} onChange={(v) => setDraft({ ...draft, opportunity: { ...draft.opportunity, title: v } })} />
      <Field label="Subtitle" value={draft.opportunity.subtitle} onChange={(v) => setDraft({ ...draft, opportunity: { ...draft.opportunity, subtitle: v } })} />
      <div className="space-y-2">
        {draft.opportunity.urgencyItems.map((u, i) => (
          <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <Field label="Icon" value={u.icon} onChange={(v) => { const next = [...draft.opportunity.urgencyItems]; next[i] = { ...u, icon: v }; setDraft({ ...draft, opportunity: { ...draft.opportunity, urgencyItems: next } }); }} />
              <Field label="Title" value={u.title} onChange={(v) => { const next = [...draft.opportunity.urgencyItems]; next[i] = { ...u, title: v }; setDraft({ ...draft, opportunity: { ...draft.opportunity, urgencyItems: next } }); }} />
            </div>
            <Field label="Description" value={u.description} onChange={(v) => { const next = [...draft.opportunity.urgencyItems]; next[i] = { ...u, description: v }; setDraft({ ...draft, opportunity: { ...draft.opportunity, urgencyItems: next } }); }} rows={2} />
            <button onClick={() => setDraft({ ...draft, opportunity: { ...draft.opportunity, urgencyItems: draft.opportunity.urgencyItems.filter((_, ix) => ix !== i) } })} className="font-body text-[11px] text-red-400">Remove</button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, opportunity: { ...draft.opportunity, urgencyItems: [...draft.opportunity.urgencyItems, { icon: "🔴", title: "", description: "" }] } })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add item</button>
      </div>
    </SectionShell>
  );

  if (section === "faq") return (
    <SectionShell label="FAQ" icon="❓">
      <Field label="Title" value={draft.faq.title} onChange={(v) => setDraft({ ...draft, faq: { ...draft.faq, title: v } })} />
      <div className="space-y-2">
        {draft.faq.items.map((f, i) => (
          <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
            <Field label="Question" value={f.question} onChange={(v) => { const next = [...draft.faq.items]; next[i] = { ...f, question: v }; setDraft({ ...draft, faq: { ...draft.faq, items: next } }); }} />
            <Field label="Answer" value={f.answer} onChange={(v) => { const next = [...draft.faq.items]; next[i] = { ...f, answer: v }; setDraft({ ...draft, faq: { ...draft.faq, items: next } }); }} rows={3} />
            <button onClick={() => setDraft({ ...draft, faq: { ...draft.faq, items: draft.faq.items.filter((_, ix) => ix !== i) } })} className="font-body text-[11px] text-red-400">Remove</button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, faq: { ...draft.faq, items: [...draft.faq.items, { question: "", answer: "" }] } })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add FAQ</button>
      </div>
    </SectionShell>
  );

  if (section === "bottomCta") return (
    <SectionShell label="Bottom CTA" icon="🎯">
      <Field label="Title" value={draft.bottomCta.title} onChange={(v) => setDraft({ ...draft, bottomCta: { ...draft.bottomCta, title: v } })} />
      <Field label="Subtitle" value={draft.bottomCta.subtitle} onChange={(v) => setDraft({ ...draft, bottomCta: { ...draft.bottomCta, subtitle: v } })} />
      <Field label="Button text" value={draft.bottomCta.buttonText} onChange={(v) => setDraft({ ...draft, bottomCta: { ...draft.bottomCta, buttonText: v } })} />
    </SectionShell>
  );

  if (section === "footer") return (
    <SectionShell label="Footer" icon="📄">
      <Field label="Copyright" value={draft.footer.copyright} onChange={(v) => setDraft({ ...draft, footer: { ...draft.footer, copyright: v } })} />
      <Field label="Disclaimer" value={draft.footer.disclaimer} onChange={(v) => setDraft({ ...draft, footer: { ...draft.footer, disclaimer: v } })} rows={3} />
    </SectionShell>
  );

  return null;
}

// ─── Webinar section editor ───────────────────────────────────────────────────

function WebinarSectionEditor({
  draft, setDraft, section,
}: { draft: WebinarPageContent; setDraft: (d: WebinarPageContent) => void; section: string }) {
  const h = draft.hero;
  const setHero = (patch: Partial<typeof h>) => setDraft({ ...draft, hero: { ...h, ...patch } });

  if (section === "hero") return (
    <SectionShell label="Squeeze Page" icon="📺">
      <Field label="Badge" value={h.badge} onChange={(v) => setHero({ badge: v })} />
      <Field label="Headline" value={h.headline} onChange={(v) => setHero({ headline: v })} />
      <Field label="Subheadline" value={h.subheadline} onChange={(v) => setHero({ subheadline: v })} rows={3} />
      <Field label="Timer label" value={h.timerLabel} onChange={(v) => setHero({ timerLabel: v })} />
      <Field label="Button text" value={h.buttonText} onChange={(v) => setHero({ buttonText: v })} />
      <ArrayField
        label="Bullets"
        items={h.bullets}
        emptyItem=""
        onAdd={(next) => setHero({ bullets: next })}
        renderItem={(b, _idx, set, remove) => (
          <div className="flex gap-2">
            <input value={b} onChange={(e) => set(e.target.value)} className="flex-1 theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
            <button onClick={remove} className="font-body text-[11px] text-red-400 px-2">✕</button>
          </div>
        )}
      />
      <div>
        <div className="font-body text-[11px] uppercase tracking-[1.2px] theme-text-muted mb-2">Stats</div>
        <div className="space-y-2">
          {h.stats.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input value={s.value} onChange={(e) => { const next = [...h.stats]; next[i] = { ...s, value: e.target.value }; setHero({ stats: next }); }} placeholder="Value" className="theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
              <input value={s.label} onChange={(e) => { const next = [...h.stats]; next[i] = { ...s, label: e.target.value }; setHero({ stats: next }); }} placeholder="Label" className="theme-input rounded-xl px-3 py-2 font-body text-[13px]" />
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );

  if (section === "watchPage") return (
    <SectionShell label="Watch Page" icon="▶️">
      <Field label="Welcome heading" value={draft.watchPage.welcomeHeading} hint="Use {name} for personalization" onChange={(v) => setDraft({ ...draft, watchPage: { ...draft.watchPage, welcomeHeading: v } })} />
      <Field label="Subtitle" value={draft.watchPage.subtitle} onChange={(v) => setDraft({ ...draft, watchPage: { ...draft.watchPage, subtitle: v } })} />
      <Field label="CTA title" value={draft.watchPage.ctaTitle} onChange={(v) => setDraft({ ...draft, watchPage: { ...draft.watchPage, ctaTitle: v } })} />
      <Field label="CTA subtitle" value={draft.watchPage.ctaSubtitle} onChange={(v) => setDraft({ ...draft, watchPage: { ...draft.watchPage, ctaSubtitle: v } })} />
      <Field label="CTA button text" value={draft.watchPage.ctaButton} onChange={(v) => setDraft({ ...draft, watchPage: { ...draft.watchPage, ctaButton: v } })} />
    </SectionShell>
  );

  if (section === "takeaways") return (
    <SectionShell label="Takeaways" icon="✅">
      <div className="space-y-2">
        {draft.takeaways.map((t, i) => (
          <div key={i} className="rounded-xl border border-[var(--app-border)] p-3 space-y-2">
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <Field label="Icon" value={t.icon} onChange={(v) => { const next = [...draft.takeaways]; next[i] = { ...t, icon: v }; setDraft({ ...draft, takeaways: next }); }} />
              <Field label="Title" value={t.title} onChange={(v) => { const next = [...draft.takeaways]; next[i] = { ...t, title: v }; setDraft({ ...draft, takeaways: next }); }} />
            </div>
            <Field label="Description" value={t.description} onChange={(v) => { const next = [...draft.takeaways]; next[i] = { ...t, description: v }; setDraft({ ...draft, takeaways: next }); }} rows={2} />
            <button onClick={() => setDraft({ ...draft, takeaways: draft.takeaways.filter((_, ix) => ix !== i) })} className="font-body text-[11px] text-red-400">Remove</button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, takeaways: [...draft.takeaways, { icon: "✨", title: "", description: "" }] })} className="font-body text-[12px] px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition">+ Add takeaway</button>
      </div>
    </SectionShell>
  );

  if (section === "footer") return (
    <SectionShell label="Footer" icon="📄">
      <Field label="Copyright" value={draft.footer.copyright} onChange={(v) => setDraft({ ...draft, footer: { ...draft.footer, copyright: v } })} />
      <Field label="Disclaimer" value={draft.footer.disclaimer} onChange={(v) => setDraft({ ...draft, footer: { ...draft.footer, disclaimer: v } })} rows={3} />
    </SectionShell>
  );

  return null;
}
