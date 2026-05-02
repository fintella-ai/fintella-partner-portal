"use client";

import { useEffect, useState } from "react";
import { useEntity, type OpsEntity } from "@/components/ops/EntityContext";

// ── Types ────────────────────────────────────────────────────────────────────

interface EntityStats {
  slug: string;
  channelCount: number;
  unreadCount: number;
  pendingRequestCount: number;
}

// ── Globe icon ───────────────────────────────────────────────────────────────

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Stat badge ───────────────────────────────────────────────────────────────

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color: color ?? "var(--app-text)" }}
      >
        {value}
      </span>
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "var(--app-text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Entity card ──────────────────────────────────────────────────────────────

function EntityCard({
  entity,
  stats,
}: {
  entity: OpsEntity;
  stats: EntityStats | undefined;
}) {
  const { setActiveEntity } = useEntity();

  return (
    <button
      onClick={() => setActiveEntity(entity)}
      className="text-left rounded-xl p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg active:scale-[0.99] group"
      style={{
        background: "var(--app-card-bg)",
        border: `1px solid var(--app-card-border)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: entity.colorAccent }}
        >
          {entity.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3
            className="text-base font-semibold truncate group-hover:underline"
            style={{ color: "var(--app-text)" }}
          >
            {entity.name}
          </h3>
          <span
            className="text-xs"
            style={{ color: "var(--app-text-muted)" }}
          >
            {entity.myRole ?? "member"}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="flex items-center justify-around rounded-lg px-3 py-2.5"
        style={{ background: "var(--app-bg)" }}
      >
        <StatBadge
          label="Members"
          value={entity.memberCount}
          color={entity.colorAccent}
        />
        <div
          className="w-px h-8 mx-1"
          style={{ background: "var(--app-border)" }}
        />
        <StatBadge
          label="Channels"
          value={stats?.channelCount ?? 0}
          color={entity.colorAccent}
        />
        <div
          className="w-px h-8 mx-1"
          style={{ background: "var(--app-border)" }}
        />
        <StatBadge
          label="Unread"
          value={stats?.unreadCount ?? 0}
          color={
            (stats?.unreadCount ?? 0) > 0 ? "#ef4444" : entity.colorAccent
          }
        />
        <div
          className="w-px h-8 mx-1"
          style={{ background: "var(--app-border)" }}
        />
        <StatBadge
          label="Pending"
          value={stats?.pendingRequestCount ?? 0}
          color={
            (stats?.pendingRequestCount ?? 0) > 0
              ? "#f59e0b"
              : entity.colorAccent
          }
        />
      </div>
    </button>
  );
}

// ── Summary card (All Entities) ──────────────────────────────────────────────

function SummaryCard({
  entities,
  allStats,
}: {
  entities: OpsEntity[];
  allStats: EntityStats[];
}) {
  const { setActiveEntity } = useEntity();
  const totalMembers = entities.reduce((s, e) => s + e.memberCount, 0);
  const totalChannels = allStats.reduce((s, st) => s + st.channelCount, 0);
  const totalUnread = allStats.reduce((s, st) => s + st.unreadCount, 0);
  const totalPending = allStats.reduce(
    (s, st) => s + st.pendingRequestCount,
    0
  );

  return (
    <button
      onClick={() => setActiveEntity(null)}
      className="text-left rounded-xl p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg active:scale-[0.99] group col-span-full"
      style={{
        background: "var(--app-card-bg)",
        border: "1px solid var(--app-card-border)",
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "var(--brand-gold-muted)",
            color: "var(--brand-gold)",
          }}
        >
          <GlobeIcon className="w-5 h-5" />
        </span>
        <div>
          <h3
            className="text-base font-semibold group-hover:underline"
            style={{ color: "var(--app-text)" }}
          >
            All Entities
          </h3>
          <span
            className="text-xs"
            style={{ color: "var(--app-text-muted)" }}
          >
            Cross-entity overview
          </span>
        </div>
        {/* Entity dots */}
        <div className="flex items-center gap-1.5 ml-auto">
          {entities.map((e) => (
            <span
              key={e.slug}
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: e.colorAccent }}
              title={e.name}
            />
          ))}
        </div>
      </div>

      <div
        className="flex items-center justify-around rounded-lg px-3 py-2.5"
        style={{ background: "var(--app-bg)" }}
      >
        <StatBadge label="Entities" value={entities.length} />
        <div
          className="w-px h-8 mx-1"
          style={{ background: "var(--app-border)" }}
        />
        <StatBadge label="Members" value={totalMembers} />
        <div
          className="w-px h-8 mx-1"
          style={{ background: "var(--app-border)" }}
        />
        <StatBadge label="Channels" value={totalChannels} />
        <div
          className="w-px h-8 mx-1"
          style={{ background: "var(--app-border)" }}
        />
        <StatBadge
          label="Unread"
          value={totalUnread}
          color={totalUnread > 0 ? "#ef4444" : undefined}
        />
        <div
          className="w-px h-8 mx-1"
          style={{ background: "var(--app-border)" }}
        />
        <StatBadge
          label="Pending"
          value={totalPending}
          color={totalPending > 0 ? "#f59e0b" : undefined}
        />
      </div>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OpsHomePage() {
  const { entities, loading } = useEntity();
  const [stats, setStats] = useState<EntityStats[]>([]);

  // Fetch per-entity stats. The channels and requests APIs already support
  // entityId filtering. We aggregate client-side for the dashboard cards.
  useEffect(() => {
    if (entities.length === 0) return;

    async function fetchStats() {
      const results: EntityStats[] = [];

      for (const entity of entities) {
        try {
          const [chRes, reqRes] = await Promise.all([
            fetch(`/api/ops/channels?entityId=${entity.id}`),
            fetch(`/api/ops/requests?entityId=${entity.id}`),
          ]);

          const channels = chRes.ok ? await chRes.json() : [];
          const requests = reqRes.ok ? await reqRes.json() : [];

          const channelList = Array.isArray(channels) ? channels : channels.channels ?? [];
          const requestList = Array.isArray(requests) ? requests : requests.requests ?? [];

          results.push({
            slug: entity.slug,
            channelCount: channelList.length,
            unreadCount: channelList.reduce(
              (s: number, c: { unreadCount?: number }) =>
                s + (c.unreadCount ?? 0),
              0
            ),
            pendingRequestCount: requestList.filter(
              (r: { status?: string }) => r.status === "pending"
            ).length,
          });
        } catch {
          results.push({
            slug: entity.slug,
            channelCount: 0,
            unreadCount: 0,
            pendingRequestCount: 0,
          });
        }
      }

      setStats(results);
    }

    fetchStats();
  }, [entities]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div
            className="h-8 w-48 rounded-lg animate-pulse mb-2"
            style={{ background: "var(--app-hover)" }}
          />
          <div
            className="h-4 w-72 rounded animate-pulse"
            style={{ background: "var(--app-hover)" }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl animate-pulse"
              style={{ background: "var(--app-hover)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-xl sm:text-2xl font-bold mb-1"
          style={{ color: "var(--app-text)" }}
        >
          Ops Center
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--app-text-muted)" }}
        >
          Your entities and workspace overview
        </p>
      </div>

      {/* Entity grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* All Entities summary */}
        <SummaryCard entities={entities} allStats={stats} />

        {/* Individual entity cards */}
        {entities.map((entity) => (
          <EntityCard
            key={entity.slug}
            entity={entity}
            stats={stats.find((s) => s.slug === entity.slug)}
          />
        ))}
      </div>
    </div>
  );
}
