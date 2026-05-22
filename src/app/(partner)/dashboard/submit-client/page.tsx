"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDevice } from "@/lib/useDevice";
import { FIRM_SHORT } from "@/lib/constants";
import { useService } from "@/contexts/ServiceContext";

const BASE_REFERRAL_URL = "https://referral.frostlawaz.com/l/ANNEXATIONPR/";

export default function SubmitClientPage() {
  const { data: session } = useSession();
  const device = useDevice();
  const router = useRouter();
  const { activeService } = useService();
  const user = session?.user as any;
  const partnerCode = user?.partnerCode || "DEMO";
  const partnerName = user?.name || "Partner";
  const [agreementSigned, setAgreementSigned] = useState<boolean | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [serviceFormFields, setServiceFormFields] = useState<any[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (activeService && activeService.slug !== "tariff-refund") {
      fetch(`/api/services`)
        .then((r) => r.json())
        .then((data) => {
          const svc = (data.services || []).find((s: any) => s.id === activeService.id);
          setServiceFormFields(svc?.formFieldsConfig || null);
        })
        .catch(() => {});
    }
  }, [activeService]);

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

  // Build the referral URL with the partner's code
  const referralUrl = `${BASE_REFERRAL_URL}?utm_content=${partnerCode}`;

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
          Submit a Client
        </h2>
        <p className="font-body text-[13px] text-[var(--app-text-muted)] mb-4">
          Use the form below to submit a client referral. This submission is tracked to your partner account.
        </p>

        <div
          className={`card ${device.cardPadding} ${device.borderRadius} border border-yellow-500/25`}
        >
          <div className="text-center py-6">
            {/* Lock icon */}
            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>

            <h3 className="font-display text-lg sm:text-xl font-bold mb-2">
              Partnership Agreement Required
            </h3>
            <p className="font-body text-sm text-[var(--app-text-secondary)] mb-6 max-w-md mx-auto leading-relaxed">
              You must sign your partnership agreement before submitting clients.
              Please visit the Documents tab to complete your agreement.
            </p>

            <button
              type="button"
              onClick={() => router.push("/dashboard/documents")}
              className="btn-gold w-full max-w-xs mx-auto"
            >
              Go to Documents &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-tariff services: native form instead of Frost Law iframe
  if (activeService && activeService.slug !== "tariff-refund") {
    return renderServiceForm();
  }

  return (
    <div>
      <h2 className={`font-display ${device.isMobile ? "text-lg" : "text-[22px]"} font-bold mb-1.5`}>
        Submit a Client
      </h2>
      <p className="font-body text-[13px] text-[var(--app-text-muted)] mb-4">
        Use the form below to submit a client referral. This submission is tracked to your partner account.
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
      </div>

      {/* Embedded referral form */}
      <div className={`card overflow-hidden ${device.borderRadius}`}>
        <div className="px-4 py-3 border-b border-[var(--app-border)] flex items-center justify-between gap-3">
          <div className="font-body text-[12px] text-[var(--app-text-muted)]">
            Client Submission Form — tracked to <span className="text-brand-gold font-semibold">{partnerCode}</span>
          </div>
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Reset the form to submit another client"
            className="font-body text-[11px] text-brand-gold/80 border border-brand-gold/25 rounded-lg px-3 py-1.5 hover:bg-brand-gold/10 transition-colors flex items-center gap-1.5 min-h-[32px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        {/* Cropped iframe — hides Frost Law nav+hero at top and the footer /
            newsletter block at the bottom. Container height is the visible
            window; iframe is positioned absolute with a negative `top` to
            push the hero out of view and enough extra height to keep the
            form + calendar page scrollable without the footer leaking in.
            Dropped `allow-top-navigation` so the form's post-submit
            calendar redirect stays inside this iframe. */}
        <div
          className="overflow-hidden relative"
          style={{
            background: "#0c1630",
            height: device.isMobile ? "calc(100vh - 280px)" : "72vh",
            minHeight: 680,
          }}
        >
          <iframe
            key={iframeKey}
            src={referralUrl}
            className="w-full border-0 absolute"
            title="Client Referral Submission"
            allow="camera; microphone; geolocation"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            style={{
              top: device.isMobile ? -450 : -680,
              left: 0,
              width: "100%",
              height: device.isMobile ? "calc(100% + 800px)" : "calc(100% + 1100px)",
            }}
          />
        </div>
      </div>

      {/* Info footer */}
      <div className="mt-4 font-body text-[11px] text-[var(--app-text-faint)] text-center leading-relaxed">
        All submissions through this form are automatically tracked to your partner account ({partnerCode}).
        <br />
        Your downline partners have their own unique links. Contact {FIRM_SHORT} support with any questions.
      </div>
    </div>
  );

  async function handleServiceSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, any> = {};
    fd.forEach((v, k) => { body[k] = v; });
    body.serviceSlug = activeService?.slug;
    body.utm_content = partnerCode;
    body.dealName = `${body.firstName || ""} ${body.lastName || ""} — ${activeService?.name || ""}`.trim();
    try {
      const res = await fetch("/api/webhook/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Submission failed (${res.status})`);
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  function renderServiceForm() {
    if (!activeService) return null;
    if (submitted) {
      return (
        <div>
          <h2 className={`font-display ${device.isMobile ? "text-lg" : "text-[22px]"} font-bold mb-1.5`}>
            Client Submitted
          </h2>
          <div className="card p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${activeService.accentColor || "#10b981"}20` }}>
              <span className="text-3xl">✓</span>
            </div>
            <h3 className="font-display text-lg font-bold mb-2">Thank you!</h3>
            <p className="font-body text-sm text-[var(--app-text-secondary)] mb-6">
              Your client has been submitted for {activeService.name}. Our team will follow up within 24 hours.
            </p>
            <button onClick={() => { setSubmitted(false); setSubmitError(""); }} className="btn-gold">
              Submit Another Client
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h2 className={`font-display ${device.isMobile ? "text-lg" : "text-[22px]"} font-bold mb-1.5`}>
          Submit a Client — {activeService.name}
        </h2>
        <p className="font-body text-[13px] text-[var(--app-text-muted)] mb-4">
          Fill out the form below to submit a client for {activeService.name}. This submission is tracked to your partner account.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 card px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${activeService.accentColor || "#10b981"}20`, border: `1px solid ${activeService.accentColor || "#10b981"}40` }}>
              <span className="font-body text-[11px] font-bold" style={{ color: activeService.accentColor || "#10b981" }}>
                {partnerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="font-body text-[13px] text-[var(--app-text)] font-medium">{partnerName}</div>
              <div className="font-mono text-[11px] text-[var(--app-text-muted)]">{partnerCode}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${activeService.accentColor || "#10b981"}20`, color: activeService.accentColor || "#10b981" }}>
            {activeService.shortName || activeService.name}
          </span>
        </div>

        <form onSubmit={handleServiceSubmit} className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input name="firstName" placeholder="First Name *" required className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />
            <input name="lastName" placeholder="Last Name *" required className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />
          </div>
          <input name="email" type="email" placeholder="Email *" required className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />
          <input name="phone" type="tel" placeholder="Phone" className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />
          <input name="legalEntityName" placeholder="Company / Legal Entity *" required className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />
          <input name="companyEin" placeholder="EIN (optional)" className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />

          {Array.isArray(serviceFormFields) && serviceFormFields.map((f: any) => (
            <div key={f.key}>
              {f.type === "select" && f.options ? (
                <select name={f.key} required={f.required} className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body">
                  <option value="">{f.label}{f.required ? " *" : ""}</option>
                  {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea name={f.key} placeholder={`${f.label}${f.required ? " *" : ""}`} required={f.required} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />
              ) : (
                <input name={f.key} placeholder={`${f.label}${f.required ? " *" : ""}`} required={f.required} className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />
              )}
            </div>
          ))}

          <textarea name="affiliateNotes" placeholder="Additional Notes (optional)" rows={2} className="w-full px-3 py-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] text-sm font-body" />

          {submitError && (
            <div className="text-red-400 text-sm font-body">{submitError}</div>
          )}

          <button type="submit" disabled={submitting} className="btn-gold w-full" style={activeService.accentColor ? { backgroundColor: activeService.accentColor, borderColor: activeService.accentColor } : {}}>
            {submitting ? "Submitting..." : `Submit Client for ${activeService.shortName || activeService.name}`}
          </button>
        </form>

        <div className="mt-4 font-body text-[11px] text-[var(--app-text-faint)] text-center leading-relaxed">
          All submissions are tracked to your partner account ({partnerCode}).
          <br />
          Contact {FIRM_SHORT} support with any questions.
        </div>
      </div>
    );
  }
}
