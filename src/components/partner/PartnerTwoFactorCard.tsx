"use client";

import { useEffect, useState } from "react";
import BackupCodesPanel from "@/components/auth/BackupCodesPanel";

/**
 * Partner-facing Two-Factor Authentication (TOTP) enrollment card. The partner
 * analogue of components/admin/TwoFactorCard — identical UX, but driven by
 * /api/partner/2fa (which resolves the partner's login identity automatically).
 *
 * Opt-in by default: a partner who ignores this card logs in exactly as before.
 * If the super-admin turns ON "Require 2FA for partners", the mandatory
 * ForcedTwoFactorEnroll screen takes over at login instead, and the Disable
 * button here returns a 403 (the API blocks opting out while enforced).
 */
export default function PartnerTwoFactorCard() {
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

  useEffect(() => {
    fetch("/api/partner/2fa")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ enabled }) => setEnabled(!!enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function post(action: string, code?: string) {
    const res = await fetch("/api/partner/2fa", {
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

  const inputClass =
    "w-full theme-input rounded-lg px-4 py-3 font-body text-sm outline-none focus:border-brand-gold/40 transition-colors";
  const labelClass =
    "font-body text-[11px] tracking-[1px] uppercase theme-text-muted mb-2 block";

  return (
    <div className="card p-5 sm:p-6">
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
        Add a time-based one-time code (Google Authenticator, 1Password, Authy) to your portal
        login for extra security. If you sign in with Google, your Google account already provides
        this — you don&apos;t need to set it up here.
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
        <BackupCodesPanel codes={backupCodes} portalLabel="Fintella Partner Portal" />
      )}

      {/* Enrollment QR flow */}
      {!enabled && qrDataUrl && (
        <div className="mb-2">
          <p className="font-body text-[12px] theme-text-muted mb-3">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="2FA QR code" className="w-40 h-40 rounded-lg bg-white p-2" />
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
            <button onClick={handleEnable} disabled={busy} className="btn-gold text-[12px] px-6 py-2.5 disabled:opacity-50">
              {busy ? "Verifying…" : "Verify & Enable"}
            </button>
            <button
              onClick={() => { setQrDataUrl(""); setSecret(""); setEnrollCode(""); }}
              disabled={busy}
              className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-[var(--app-border)] theme-text-muted hover:theme-text disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Idle states */}
      {!loading && !enabled && !qrDataUrl && (
        <button onClick={handleSetup} disabled={busy} className="btn-gold text-[12px] px-6 py-2.5 disabled:opacity-50">
          {busy ? "Starting…" : "Enable 2FA"}
        </button>
      )}

      {!loading && enabled && !showDisable && backupCodes.length === 0 && (
        <button
          onClick={() => { setShowDisable(true); setMessage(null); }}
          className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/[0.08] transition-colors"
        >
          Disable 2FA
        </button>
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
            <button onClick={handleDisable} disabled={busy} className="font-body text-[12px] px-6 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/[0.08] transition-colors disabled:opacity-50">
              {busy ? "Disabling…" : "Confirm Disable"}
            </button>
            <button
              onClick={() => { setShowDisable(false); setDisableCode(""); }}
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
