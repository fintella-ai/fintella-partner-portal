"use client";

import { useEffect, useState } from "react";
import BackupCodesPanel from "@/components/auth/BackupCodesPanel";

/**
 * Opt-in admin Two-Factor Authentication (TOTP) enrollment card.
 *
 * Drops into the admin account page. All state is driven by /api/admin/2fa:
 *   GET            → { enabled }
 *   POST {setup}   → { qrDataUrl, secret }  (pending secret stored server-side)
 *   POST {enable}  → { enabled, backupCodes } (codes shown ONCE)
 *   POST {disable} → { enabled: false } (requires a current code)
 *
 * Strictly opt-in: nothing here forces 2FA. An admin who ignores this card
 * logs in exactly as before.
 */
export default function TwoFactorCard() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Enrollment flow state
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [enrollCode, setEnrollCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable flow state
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  // Backup-code health + regenerate flow state
  const [backupRemaining, setBackupRemaining] = useState<number | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regenCode, setRegenCode] = useState("");

  useEffect(() => {
    fetch("/api/admin/2fa")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ enabled, backupCodesRemaining }) => {
        setEnabled(!!enabled);
        if (typeof backupCodesRemaining === "number") setBackupRemaining(backupCodesRemaining);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function post(action: string, code?: string) {
    const res = await fetch("/api/admin/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function handleSetup() {
    setMessage(null);
    setBusy(true);
    try {
      const data = await post("setup");
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
    } catch (e: any) {
      setMessage({ text: e?.message || "Could not start setup.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleEnable() {
    setMessage(null);
    if (!enrollCode.trim()) {
      setMessage({ text: "Enter the 6-digit code from your authenticator app.", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const data = await post("enable", enrollCode.trim());
      setEnabled(true);
      setBackupCodes(data.backupCodes || []);
      setBackupRemaining((data.backupCodes || []).length);
      setQrDataUrl("");
      setSecret("");
      setEnrollCode("");
      setMessage({ text: "Two-factor authentication is now enabled.", type: "success" });
    } catch (e: any) {
      setMessage({ text: e?.message || "Verification failed.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setMessage(null);
    if (!disableCode.trim()) {
      setMessage({ text: "Enter a current 2FA or backup code to disable.", type: "error" });
      return;
    }
    setBusy(true);
    try {
      await post("disable", disableCode.trim());
      setEnabled(false);
      setShowDisable(false);
      setDisableCode("");
      setBackupCodes([]);
      setMessage({ text: "Two-factor authentication disabled.", type: "success" });
    } catch (e: any) {
      setMessage({ text: e?.message || "Could not disable.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setMessage(null);
    if (!regenCode.trim()) {
      setMessage({ text: "Enter a current 2FA or backup code to regenerate.", type: "error" });
      return;
    }
    setBusy(true);
    try {
      const data = await post("regenerate", regenCode.trim());
      const fresh: string[] = data.backupCodes || [];
      setBackupCodes(fresh);
      setBackupRemaining(fresh.length);
      setShowRegenerate(false);
      setRegenCode("");
      setMessage({ text: "New backup codes generated. Your old codes no longer work.", type: "success" });
    } catch (e: any) {
      setMessage({ text: e?.message || "Could not regenerate backup codes.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full theme-input rounded-lg px-4 py-3 font-body text-sm outline-none focus:border-brand-gold/40 transition-colors";
  const labelClass =
    "font-body text-[11px] tracking-[1px] uppercase theme-text-muted mb-2 block";

  return (
    <div className="card p-5 sm:p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="font-body font-semibold text-sm">Two-Factor Authentication</div>
        <span
          className={`font-body text-[11px] px-2 py-0.5 rounded-full ${
            enabled
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "theme-text-faint border border-[var(--app-border)]"
          }`}
        >
          {loading ? "…" : enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <p className="font-body text-[12px] theme-text-muted mb-4">
        Add a time-based one-time code (Google Authenticator, 1Password, Authy) to your admin
        login. Optional — you can keep signing in with just your password.
      </p>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg font-body text-[13px] ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Backup codes — shown exactly once after enabling */}
      {backupCodes.length > 0 && (
        <BackupCodesPanel codes={backupCodes} portalLabel="Fintella Admin" />
      )}

      {/* Enrollment QR flow */}
      {!enabled && qrDataUrl && (
        <div className="mb-2">
          <p className="font-body text-[12px] theme-text-muted mb-3">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="2FA QR code"
              className="w-40 h-40 rounded-lg bg-white p-2"
            />
            <div className="flex-1 min-w-0">
              <label className={labelClass}>Or enter this key manually</label>
              <code className="block break-all font-mono text-[12px] theme-text-secondary bg-black/20 rounded px-3 py-2">
                {secret}
              </code>
            </div>
          </div>
          <label className={labelClass}>Verification Code</label>
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={enrollCode}
            onChange={(e) => setEnrollCode(e.target.value)}
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleEnable}
              disabled={busy}
              className="btn-gold text-[12px] px-6 py-2.5 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & Enable"}
            </button>
            <button
              onClick={() => {
                setQrDataUrl("");
                setSecret("");
                setEnrollCode("");
              }}
              disabled={busy}
              className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-[var(--app-border)] theme-text-muted hover:theme-text disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Idle states: enable button (disabled) / disable flow (enabled) */}
      {!loading && !enabled && !qrDataUrl && (
        <button
          onClick={handleSetup}
          disabled={busy}
          className="btn-gold text-[12px] px-6 py-2.5 disabled:opacity-50"
        >
          {busy ? "Starting…" : "Enable 2FA"}
        </button>
      )}

      {/* Idle enabled state — backup-code health + management actions */}
      {!loading && enabled && !showDisable && !showRegenerate && backupCodes.length === 0 && (
        <div>
          {backupRemaining !== null && (
            <div
              className={`mb-4 flex items-start gap-2.5 p-3 rounded-lg border ${
                backupRemaining <= 2
                  ? "bg-amber-500/[0.08] border-amber-500/25"
                  : "bg-black/10 border-[var(--app-border)]"
              }`}
            >
              <svg
                className={`w-4 h-4 mt-0.5 shrink-0 ${backupRemaining <= 2 ? "text-amber-300" : "theme-text-muted"}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z" />
              </svg>
              <div className="min-w-0">
                <p className={`font-body text-[12px] ${backupRemaining <= 2 ? "text-amber-200" : "theme-text-secondary"}`}>
                  <span className="font-semibold">{backupRemaining}</span> of 10 backup codes left
                </p>
                {backupRemaining <= 2 && (
                  <p className="font-body text-[11px] text-amber-300/80 mt-0.5">
                    {backupRemaining === 0
                      ? "You have no backup codes left — regenerate now so you're not locked out if you lose your authenticator."
                      : "Running low — regenerate to get a fresh set of 10 before you run out."}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowRegenerate(true);
                setMessage(null);
              }}
              className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-[var(--app-border)] theme-text-secondary hover:theme-text transition-colors"
            >
              Regenerate backup codes
            </button>
            <button
              onClick={() => {
                setShowDisable(true);
                setMessage(null);
              }}
              className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/[0.08] transition-colors"
            >
              Disable 2FA
            </button>
          </div>
        </div>
      )}

      {/* Regenerate backup codes — requires a current code */}
      {!loading && enabled && showRegenerate && (
        <div>
          <label className={labelClass}>Enter a current 2FA or backup code to regenerate</label>
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456 or backup code"
            value={regenCode}
            onChange={(e) => setRegenCode(e.target.value)}
          />
          <p className="font-body text-[11px] theme-text-muted mt-2">
            This issues a fresh set of 10 codes and immediately invalidates your old ones.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleRegenerate}
              disabled={busy}
              className="btn-gold text-[12px] px-6 py-2.5 disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate new codes"}
            </button>
            <button
              onClick={() => {
                setShowRegenerate(false);
                setRegenCode("");
              }}
              disabled={busy}
              className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-[var(--app-border)] theme-text-muted hover:theme-text disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!loading && enabled && showDisable && (
        <div>
          <label className={labelClass}>Enter a current 2FA or backup code to disable</label>
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456 or backup code"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDisable}
              disabled={busy}
              className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/[0.08] transition-colors disabled:opacity-50"
            >
              {busy ? "Disabling…" : "Confirm Disable"}
            </button>
            <button
              onClick={() => {
                setShowDisable(false);
                setDisableCode("");
              }}
              disabled={busy}
              className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-[var(--app-border)] theme-text-muted hover:theme-text disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
