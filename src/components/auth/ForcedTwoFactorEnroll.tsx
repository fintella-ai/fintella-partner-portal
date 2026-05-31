"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackupCodesPanel from "@/components/auth/BackupCodesPanel";

/**
 * Mandatory full-screen TOTP enrollment. Rendered by MfaEnforcementGate when MFA
 * enforcement is ON for the user's portal and the credentials-logged-in user
 * hasn't enrolled yet. Unlike the opt-in cards there is no cancel — the user
 * completes enrollment or signs out. Google / passkey users never see this.
 *
 * Talks to the per-portal 2FA API (same contract as /api/admin/2fa):
 *   POST {setup}        → { qrDataUrl, secret }
 *   POST {enable, code} → { enabled, backupCodes }
 *
 * On completion it calls onComplete() so the gate re-checks status (now passing)
 * and renders the app. router.refresh() is a belt-and-suspenders fallback.
 */
export default function ForcedTwoFactorEnroll({
  apiPath,
  portalLabel,
  onComplete,
}: {
  apiPath: string; // "/api/partner/2fa" | "/api/admin/2fa"
  portalLabel: string; // e.g. "partner portal"
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(action: string, codeArg?: string) {
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code: codeArg }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function startSetup() {
    setError("");
    setBusy(true);
    try {
      const data = await post("setup");
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
    } catch (e: any) {
      setError(e?.message || "Could not start setup.");
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setError("");
    if (!code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    try {
      const data = await post("enable", code.trim());
      setBackupCodes(data.backupCodes || []);
      setQrDataUrl("");
      setSecret("");
      setCode("");
    } catch (e: any) {
      setError(e?.message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    onComplete?.();
    router.refresh();
  }

  const inputClass =
    "w-full theme-input rounded-lg px-4 py-3 font-body text-sm outline-none focus:border-brand-gold/40 transition-colors";
  const labelClass =
    "font-body text-[11px] tracking-[1px] uppercase theme-text-muted mb-2 block";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#000000" }}>
      <div className="w-full max-w-[460px] card rounded-2xl p-6 sm:p-8" style={{ borderColor: "rgba(196,160,80,0.18)" }}>
        <div className="mb-5">
          <div className="font-body text-[10px] tracking-[1.5px] uppercase text-brand-gold mb-2">
            Security Required
          </div>
          <h1 className="font-display text-[22px] font-bold mb-2 theme-text">
            Set up two-factor authentication
          </h1>
          <p className="font-body text-[13px] theme-text-muted leading-relaxed">
            Two-factor authentication is now required to use the {portalLabel}. It takes about a
            minute with an authenticator app — Google Authenticator, Authy, or 1Password.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/25 font-body text-[13px] text-red-400">
            {error}
          </div>
        )}

        {/* Backup codes — shown exactly once after enabling */}
        {backupCodes.length > 0 ? (
          <div className="space-y-4">
            <BackupCodesPanel codes={backupCodes} portalLabel={portalLabel === "admin dashboard" ? "Fintella Admin" : "Fintella Partner Portal"} />
            <button onClick={finish} className="btn-gold w-full rounded-md min-h-[52px]">
              I&apos;ve saved them — continue →
            </button>
          </div>
        ) : qrDataUrl ? (
          /* Enrollment QR + verify */
          <div className="space-y-4">
            <p className="font-body text-[12px] theme-text-muted">
              Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="2FA QR code" className="w-40 h-40 rounded-lg bg-white p-2" />
              <div className="flex-1 min-w-0">
                <label className={labelClass}>Or enter this key manually</label>
                <code className="block break-all font-mono text-[12px] theme-text-secondary bg-black/20 rounded px-3 py-2">
                  {secret}
                </code>
              </div>
            </div>
            <div>
              <label className={labelClass}>Verification Code</label>
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <button onClick={enable} disabled={busy} className="btn-gold w-full rounded-md min-h-[52px] disabled:opacity-50">
              {busy ? "Verifying…" : "Verify & Enable"}
            </button>
          </div>
        ) : (
          <button onClick={startSetup} disabled={busy} className="btn-gold w-full rounded-md min-h-[52px] disabled:opacity-50">
            {busy ? "Starting…" : "Begin Setup"}
          </button>
        )}
      </div>
      <p className="font-body text-[11px] theme-text-faint mt-5 text-center max-w-[420px]">
        Signed in with Google? You won&apos;t see this — Google secures your account directly.
      </p>
    </div>
  );
}
