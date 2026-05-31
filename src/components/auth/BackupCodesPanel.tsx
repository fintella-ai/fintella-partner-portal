"use client";

import { useState } from "react";

/**
 * Shared "save your backup codes" panel — the amber box shown exactly once after
 * a user enables 2FA. Used by every backup-code surface (admin TwoFactorCard,
 * PartnerTwoFactorCard, ForcedTwoFactorEnroll) so Copy + Download behave
 * identically everywhere.
 *
 * Codes are shown once and never re-fetchable, so we give the user two ways to
 * keep them: copy to clipboard and download a .txt file.
 */
export default function BackupCodesPanel({
  codes,
  portalLabel = "Fintella Partner Portal",
}: {
  codes: string[];
  portalLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const plain = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(plain);
    } catch {
      // Clipboard API blocked (insecure context / permissions) → fallback to a
      // hidden textarea + execCommand so Copy still works.
      const ta = document.createElement("textarea");
      ta.value = plain;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch { /* give up silently */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const stamp = new Date().toISOString().slice(0, 10);
    const body =
      `${portalLabel} — Two-Factor Authentication backup codes\n` +
      `Generated: ${stamp}\n\n` +
      `Each code can be used ONCE if you lose access to your authenticator app.\n` +
      `Keep this file somewhere safe and private. These will not be shown again.\n\n` +
      codes.map((c, i) => `${String(i + 1).padStart(2, "0")}. ${c}`).join("\n") +
      `\n`;
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fintella-2fa-backup-codes-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  const actionBtn =
    "flex-1 flex items-center justify-center gap-1.5 font-body text-[12px] font-medium px-3 py-2 rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-500/[0.12] transition-colors min-h-[40px]";

  return (
    <div className="mb-4 p-4 rounded-lg bg-amber-500/[0.08] border border-amber-500/25">
      <p className="font-body text-[13px] text-amber-300 font-semibold mb-2">
        Save your backup codes
      </p>
      <p className="font-body text-[12px] text-amber-300/80 mb-3 leading-relaxed">
        Each code works once if you lose access to your authenticator. Save them now — they will not
        be shown again.
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-[13px] text-amber-200">
        {codes.map((c) => (
          <div key={c} className="px-2 py-1.5 rounded bg-black/30 text-center tracking-[0.15em]">
            {c}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={copy} className={actionBtn}>
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy codes
            </>
          )}
        </button>
        <button type="button" onClick={download} className={actionBtn}>
          {downloaded ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              Downloaded
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
              Download .txt
            </>
          )}
        </button>
      </div>
    </div>
  );
}
