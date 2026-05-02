"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { EntityProvider, useEntity } from "@/components/ops/EntityContext";
import EntitySwitcher from "@/components/ops/EntitySwitcher";
import { useDevice } from "@/lib/useDevice";

// ── Nav items ────────────────────────────────────────────────────────────────

const OPS_NAV = [
  {
    id: "home",
    href: "/ops",
    label: "Home",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "channels",
    href: "/ops/channels",
    label: "Channels",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
  },
  {
    id: "dms",
    href: "/ops/dms",
    label: "DMs",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: "requests",
    href: "/ops/requests",
    label: "Requests",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "ideas",
    href: "/ops/ideas",
    label: "Ideas",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: "search",
    href: "/ops/search",
    label: "Search",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
];

// ── Accent stripe ────────────────────────────────────────────────────────────

function AccentStripe() {
  const { activeEntity } = useEntity();
  const color = activeEntity?.colorAccent ?? "var(--brand-gold)";
  return (
    <div
      className="h-[3px] w-full shrink-0 transition-colors duration-300"
      style={{ background: `linear-gradient(90deg, ${color}, ${color}44)` }}
    />
  );
}

// ── Top nav bar ──────────────────────────────────────────────────────────────

function TopNav({
  onHamburger,
  isMobile,
}: {
  onHamburger: () => void;
  isMobile: boolean;
}) {
  const { data: session } = useSession();
  const user = session?.user as { name?: string; email?: string } | undefined;

  return (
    <header
      className="flex items-center gap-3 px-4 sm:px-6 h-14 shrink-0"
      style={{
        background: "var(--app-header-bg)",
        borderBottom: "1px solid var(--app-border)",
      }}
    >
      {/* Hamburger — mobile/tablet only */}
      {isMobile && (
        <button
          onClick={onHamburger}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--app-hover)] transition-colors -ml-1"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--app-text)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Logo/title */}
      <span
        className="font-display text-sm font-bold tracking-wider uppercase mr-1"
        style={{ color: "var(--brand-gold)" }}
      >
        Ops
      </span>

      {/* Entity switcher */}
      <EntitySwitcher />

      <div className="flex-1" />

      {/* User name */}
      <div className="flex items-center gap-2">
        <span
          className="text-sm truncate max-w-[160px] hidden sm:inline"
          style={{ color: "var(--app-text-secondary)" }}
        >
          {user?.name ?? user?.email ?? ""}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs px-2.5 py-1.5 rounded-md transition-colors hover:bg-[var(--app-hover)]"
          style={{ color: "var(--app-text-muted)" }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

// ── Inner layout (needs EntityProvider to be in scope) ──────────────────────

function OpsLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const device = useDevice();
  const isMobile = !device.isDesktop;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on nav
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function navigate(href: string) {
    router.push(href);
    if (isMobile) setSidebarOpen(false);
  }

  const sidebarContent = (
    <nav className="flex flex-col gap-0.5 px-2 py-3">
      {OPS_NAV.map((item) => {
        const isActive =
          item.href === "/ops"
            ? pathname === "/ops"
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <button
            key={item.id}
            onClick={() => navigate(item.href)}
            className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 min-h-[44px] ${
              isActive
                ? "bg-[var(--brand-gold-muted)] border-l-2"
                : "hover:bg-[var(--app-hover)]"
            }`}
            style={{
              color: isActive
                ? "var(--brand-gold)"
                : "var(--app-text-secondary)",
              borderColor: isActive ? "var(--brand-gold)" : "transparent",
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--app-bg)" }}>
      <AccentStripe />
      <TopNav onHamburger={() => setSidebarOpen(true)} isMobile={isMobile} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop sidebar ── */}
        {!isMobile && (
          <aside
            className="w-[220px] shrink-0 overflow-y-auto h-[calc(100vh-3px-56px)]"
            style={{
              background: "var(--app-sidebar-bg)",
              borderRight: "1px solid var(--app-border)",
            }}
          >
            {sidebarContent}
          </aside>
        )}

        {/* ── Mobile sidebar overlay ── */}
        {isMobile && sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-[998] backdrop-blur-sm"
              style={{ background: "var(--app-overlay)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className="fixed left-0 top-0 bottom-0 w-[260px] max-w-[80vw] z-[999] overflow-y-auto flex flex-col"
              style={{
                background: "var(--app-sidebar-bg)",
                borderRight: "1px solid var(--app-border)",
                animation: "slideIn .2s ease",
                paddingTop: "env(safe-area-inset-top, 0px)",
              }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <span
                  className="font-display text-sm font-bold tracking-wider uppercase"
                  style={{ color: "var(--brand-gold)" }}
                >
                  Ops Center
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--app-hover)]"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--app-text)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {sidebarContent}
            </aside>
          </>
        )}

        {/* ── Main content ── */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          style={{ minHeight: 0 }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntityProvider>
      <OpsLayoutInner>{children}</OpsLayoutInner>
    </EntityProvider>
  );
}
