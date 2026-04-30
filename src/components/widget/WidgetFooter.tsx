"use client";

export default function WidgetFooter() {
  return (
    <div style={{ flexShrink: 0, background: "#060a14" }}>
      {/* Disclaimer */}
      <div style={{
        padding: "6px 16px", borderTop: "1px solid rgba(255,255,255,0.04)",
        fontSize: 9, color: "rgba(255,255,255,0.2)", lineHeight: 1.4, textAlign: "center",
      }}>
        AI assistant — not a human. No documents are stored or retained. Data is analyzed in-memory only and discarded after processing. Not legal, tax, or financial advice.
      </div>
      {/* Footer bar */}
      <div
        style={{
          height: 32,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img
            src="/api/favicon"
            alt=""
            style={{ width: 14, height: 14, borderRadius: 3, objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            Powered by Fintella
          </span>
        </div>
        <a
          href="https://fintella.partners/dashboard"
          target="_blank"
          rel="noopener"
          style={{
            fontSize: 10,
            color: "#c4a050",
            textDecoration: "none",
            fontWeight: 500,
            animation: "portalGlow 3s ease-in-out infinite",
          }}
        >
          Full Partner Portal &rarr;
        </a>
        <style>{`
          @keyframes portalGlow {
            0%, 100% { text-shadow: 0 0 4px rgba(196,160,80,0.2); }
            50% { text-shadow: 0 0 10px rgba(196,160,80,0.5), 0 0 4px rgba(196,160,80,0.3); }
          }
        `}</style>
      </div>
    </div>
  );
}
