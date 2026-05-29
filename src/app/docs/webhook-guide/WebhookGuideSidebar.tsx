"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication & security" },
  { id: "inbound", label: "Inbound webhooks" },
  { id: "outbound", label: "Outbound webhooks" },
  { id: "workflow-variables", label: "Workflow variables" },
  { id: "api-reference", label: "API endpoints" },
  { id: "testing", label: "Testing checklist" },
  { id: "services", label: "Services reference" },
  { id: "error-handling", label: "Retry & error handling" },
];

export default function WebhookGuideSidebar() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <aside
      style={{
        position: "sticky",
        top: 40,
        width: 220,
        flexShrink: 0,
        alignSelf: "flex-start",
        paddingRight: 24,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--doc-text-muted)",
          marginBottom: 14,
        }}
      >
        On this page
      </div>
      <nav>
        {NAV_ITEMS.map(({ id, label }) => {
          const isActive = active === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              style={{
                display: "block",
                padding: "7px 12px",
                marginBottom: 2,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--doc-gold)" : "var(--doc-text-secondary)",
                textDecoration: "none",
                borderRadius: 6,
                background: isActive ? "var(--doc-step-bg)" : "transparent",
                borderLeft: isActive
                  ? "2px solid var(--doc-gold)"
                  : "2px solid transparent",
                transition: "all 0.15s",
                lineHeight: 1.4,
              }}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                setActive(id);
              }}
            >
              {label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
