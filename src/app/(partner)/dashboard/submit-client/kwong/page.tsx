"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDevice } from "@/lib/useDevice";
import { FIRM_SHORT } from "@/lib/constants";

export default function KwongSubmitPage() {
  const { data: session } = useSession();
  const device = useDevice();
  const router = useRouter();
  const user = session?.user as any;
  const partnerCode = user?.partnerCode || "DEMO";
  const partnerName = user?.name || "Partner";
  const [agreementSigned, setAgreementSigned] = useState<boolean | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/agreement")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const bypassed = data.agreementBypass === true;
        const agreementOk =
          data.agreement?.status === "signed" ||
          data.agreement?.status === "approved";
        const partnerOk = data.partnerStatus === "active";
        setAgreementSigned(bypassed || (agreementOk && partnerOk));
      })
      .catch(() => {
        setAgreementSigned(true);
      });
  }, []);

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : "https://fintella.partners"}/intake/kwong?ref=${partnerCode}`;
  const iframeSrc = `/intake/kwong?ref=${partnerCode}`;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (agreementSigned === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-body text-sm text-[var(--app-text-muted)]">Checking agreement status...</div>
      </div>
    );
  }

  if (!agreementSigned) {
    return (
      <div>
        <h2 className={`font-display ${device.isMobile ? "text-lg" : "text-[22px]"} font-bold mb-1.5`}>
          Submit a Client — Penalty Abatement (ERC)
        </h2>
        <div className={`card ${device.cardPadding} ${device.borderRadius} border border-yellow-500/25`}>
          <div className="text-center py-6">
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center">
              <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold mb-2">Partnership Agreement Required</h3>
            <p className="font-body text-sm text-[var(--app-text-secondary)] mb-6 max-w-md mx-auto leading-relaxed">
              You must sign your partnership agreement before submitting clients.
            </p>
            <button type="button" onClick={() => router.push("/dashboard/documents")} className="btn-gold w-full max-w-xs mx-auto">
              Go to Documents &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className={`font-display ${device.isMobile ? "text-lg" : "text-[22px]"} font-bold mb-1.5`}>
        Submit a Client — Penalty Abatement (ERC)
      </h2>
      <p className="font-body text-[13px] text-[var(--app-text-muted)] mb-4">
        Use the form below or share the link with your client. All submissions are tracked to your account.
      </p>

      {/* Partner info bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center">
            <span className="font-body text-[11px] font-bold text-brand-gold">
              {partnerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div>
            <div className="font-body text-[13px] text-[var(--app-text)] font-medium">{partnerName}</div>
            <div className="font-mono text-[11px] text-[var(--app-text-muted)]">{partnerCode}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-teal-500/15 text-teal-400">
          Penalty Abatement (ERC)
        </span>
      </div>

      {/* Shareable link card */}
      <div className="card px-4 py-3 mb-4 border border-teal-500/20">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="font-body text-[12px] font-semibold text-[var(--app-text)]">Share this link with your client</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 font-mono text-[12px] text-[var(--app-text-secondary)] truncate select-all">
            {shareUrl}
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex-shrink-0 font-body text-[12px] font-semibold border rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5"
            style={{
              color: copied ? "#10b981" : "#14b8a6",
              borderColor: copied ? "#10b98140" : "#14b8a640",
              background: copied ? "#10b98110" : "transparent",
            }}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Link
              </>
            )}
          </button>
        </div>
        <p className="font-body text-[11px] text-[var(--app-text-faint)] mt-2">
          Submissions through this link are automatically tracked to your partner account ({partnerCode}).
        </p>
      </div>

      {/* Embedded intake form */}
      <div className={`card overflow-hidden ${device.borderRadius}`}>
        <div className="px-4 py-3 border-b border-[var(--app-border)] flex items-center justify-between gap-3">
          <div className="font-body text-[12px] text-[var(--app-text-muted)]">
            Client Intake Form — tracked to <span className="text-teal-400 font-semibold">{partnerCode}</span>
          </div>
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Reset the form"
            className="font-body text-[11px] text-teal-400/80 border border-teal-400/25 rounded-lg px-3 py-1.5 hover:bg-teal-400/10 transition-colors flex items-center gap-1.5 min-h-[32px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        <div
          className="overflow-hidden"
          style={{
            height: device.isMobile ? "calc(100vh - 340px)" : "72vh",
            minHeight: 680,
          }}
        >
          <iframe
            key={iframeKey}
            src={iframeSrc}
            className="w-full h-full border-0"
            title="Penalty Abatement (ERC) Client Intake"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          />
        </div>
      </div>

      <div className="mt-4 font-body text-[11px] text-[var(--app-text-faint)] text-center leading-relaxed">
        All submissions are tracked to your partner account ({partnerCode}).
        <br />
        Contact {FIRM_SHORT} support with any questions.
      </div>
    </div>
  );
}
