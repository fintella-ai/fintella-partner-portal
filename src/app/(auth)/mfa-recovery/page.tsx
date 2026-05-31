"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FIRM_NAME, FIRM_SLOGAN, SUPPORT_EMAIL } from "@/lib/constants";

type TokenState =
  | { status: "checking" }
  | { status: "valid" }
  | { status: "invalid"; reason: string };

export default function MfaRecoveryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MfaRecoveryInner />
    </Suspense>
  );
}

function MfaRecoveryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [tokenState, setTokenState] = useState<TokenState>({ status: "checking" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState({ status: "invalid", reason: "This recovery link is missing its token." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/mfa-recovery/confirm?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.ok) {
          setTokenState({ status: "valid" });
        } else {
          const data = await res.json().catch(() => ({}));
          const reasonMap: Record<string, string> = {
            expired: "This recovery link has expired. Please request a new one from the sign-in page.",
            used: "This recovery link has already been used.",
            not_found: "This recovery link is invalid.",
            wrong_type: "This recovery link is invalid.",
            missing_token: "This recovery link is missing its token.",
          };
          setTokenState({ status: "invalid", reason: reasonMap[data.reason] || "This recovery link is invalid." });
        }
      } catch {
        if (!cancelled) {
          setTokenState({ status: "invalid", reason: "Could not validate link. Please try again." });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handleConfirm() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/mfa-recovery/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not remove 2FA. Please try again.");
      }
    } catch {
      setError(`Connection error. Please try again or email ${SUPPORT_EMAIL}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-10 relative overflow-hidden login-bg">
      <style>{`
        .login-bg { background: radial-gradient(ellipse 70% 60% at 50% 40%, #e8e4df 0%, #f5f6fa 70%); }
        .login-grid { background-image: linear-gradient(rgba(196,160,80,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(196,160,80,.06) 1px,transparent 1px); }
        @media (prefers-color-scheme: dark) {
          .login-bg { background: radial-gradient(ellipse 70% 60% at 50% 40%, #0d1a3a 0%, #080d1c 70%); }
          .login-grid { background-image: linear-gradient(rgba(196,160,80,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(196,160,80,.02) 1px,transparent 1px); }
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none login-grid" style={{ backgroundSize: "60px 60px" }} />

      <div className="w-full max-w-[460px] relative z-10">
        <div className="text-center mb-8 sm:mb-10 animate-fade-up">
          <div className="font-display text-sm sm:text-[15px] font-semibold text-brand-gold tracking-[2px] uppercase mb-5 leading-relaxed">
            {FIRM_NAME}
          </div>
          <h1 className="font-display text-[26px] sm:text-[32px] font-bold mb-3">
            Account <span className="gold-gradient">Recovery</span>
          </h1>
          <p className="font-body text-[13px] sm:text-sm theme-text-secondary leading-relaxed px-2 italic">
            {FIRM_SLOGAN}
          </p>
        </div>

        <div className="animate-fade-up-delay card rounded-2xl p-6 sm:p-8" style={{ borderColor: "rgba(196,160,80,0.18)" }}>
          {tokenState.status === "checking" && (
            <div className="text-center font-body text-sm theme-text-muted">Checking link…</div>
          )}

          {tokenState.status === "invalid" && (
            <div className="text-center space-y-4">
              <div className="font-body text-sm text-red-400 leading-relaxed">{tokenState.reason}</div>
              <a href="/login" className="inline-block btn-gold rounded-md min-h-[48px] px-6 leading-[48px]">
                Back to sign in
              </a>
            </div>
          )}

          {tokenState.status === "valid" && done && (
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <div className="font-body text-sm theme-text-secondary leading-relaxed">
                Two-factor authentication has been removed. You can now sign in with just your password.
              </div>
              <div className="font-body text-[12px] theme-text-muted">Redirecting to sign-in…</div>
            </div>
          )}

          {tokenState.status === "valid" && !done && (
            <div>
              <p className="font-body text-[13px] theme-text-secondary leading-relaxed mb-3">
                This will <strong className="text-brand-gold">remove two-factor authentication</strong> from your account so
                you can sign in with just your password.
              </p>
              <div className="mb-6 p-3 rounded-lg bg-amber-500/[0.08] border border-amber-500/25">
                <p className="font-body text-[12px] text-amber-300/90 leading-relaxed">
                  If your portal requires 2FA, you&apos;ll be asked to set it up again right after you sign in — so keep your
                  authenticator app handy.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3 bg-red-500/[0.08] border border-red-500/25 rounded-lg font-body text-[13px] text-red-400 leading-relaxed">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="btn-gold w-full rounded-md min-h-[52px]"
              >
                {submitting ? "Removing…" : "Remove 2FA & continue →"}
              </button>
              <div className="text-center mt-4">
                <a href="/login" className="font-body text-[12px] text-brand-gold/70 hover:text-brand-gold transition-colors">
                  ← Cancel and go back
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="font-body text-[11px] theme-text-faint text-center mt-5 leading-relaxed">
          Need help? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-brand-gold">{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </div>
  );
}
