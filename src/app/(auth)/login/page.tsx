"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FIRM_SLOGAN, SUPPORT_EMAIL } from "@/lib/constants";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  "not-invited": `This Google account isn't linked to a partner profile. Sign in with the email your invite was sent to, or email ${"support@fintella.partners"} for help.`,
  "blocked": "Your partner account is blocked. Please contact support.",
  "archived": "ARCHIVED",
  "google-no-email": "Google didn't return an email for that account. Try a different Google account.",
  "OAuthSignin": "Google sign-in is temporarily unavailable. Please try email + password below.",
  "OAuthCallback": "Google sign-in didn't complete. Please try again.",
  "AccessDenied": "Google sign-in was cancelled.",
};

export default function LoginPage() {
  // useSearchParams forces a client-side dynamic boundary — wrap in Suspense
  // so the app-router prerender doesn't bail on /login.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"partner" | "admin">("partner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  // Pull the brand logo from PortalSettings so the login chrome matches
  // whatever the admin uploaded in Settings → Brand (same source the
  // InstallPrompt + SoftPhone use).
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(({ settings }) => {
        if (settings?.logoUrl) setLogoUrl(settings.logoUrl);
      })
      .catch(() => {});
  }, []);

  // Surface ?error=… query from the signIn callback (Google rejection paths)
  // or NextAuth's own OAuth error codes.
  useEffect(() => {
    const code = searchParams?.get("error");
    if (code) {
      if (code === "archived") {
        setArchived(true);
      } else {
        setError(GOOGLE_ERROR_MESSAGES[code] || "Sign-in failed. Please try again.");
      }
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setArchived(false);
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        setError("Email and password are required.");
        setLoading(false);
        return;
      }

      const providerId = mode === "partner" ? "partner-login" : "admin-login";
      const result = await signIn(providerId, {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // Check if the account is archived (only for partner login failures)
        if (mode === "partner") {
          try {
            const checkRes = await fetch("/api/auth/check-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email.trim() }),
            });
            const checkData = await checkRes.json();
            if (checkData.status === "archived") {
              setArchived(true);
              setLoading(false);
              return;
            }
          } catch {}
        }
        setError("Invalid email or password.");
      } else {
        router.push(mode === "partner" ? "/dashboard/home" : "/admin");
      }
    } catch {
      setError(`Connection error. Please try again or email ${SUPPORT_EMAIL}.`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeyLogin() {
    setError("");
    setPasskeyLoading(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const optsRes = await fetch("/api/auth/passkey/login/options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start passkey sign-in");
      const options = await optsRes.json();

      let assertion;
      try {
        assertion = await startAuthentication(options);
      } catch (err: any) {
        // User cancelled the OS prompt (NotAllowedError) → silent no-op.
        if (err?.name === "NotAllowedError") { setPasskeyLoading(false); return; }
        throw err;
      }

      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const verifyBody = await verifyRes.json();
      if (!verifyRes.ok || !verifyBody.handoffToken) {
        setError(verifyBody.error || "Passkey verification failed.");
        setPasskeyLoading(false);
        return;
      }

      // Trade the handoff token for a real session. impersonate-login is
      // reused because the mechanics are identical (single-use token →
      // Partner session); passkey logins show up in the same audit path.
      const result = await signIn("impersonate-login", {
        token: verifyBody.handoffToken,
        redirect: false,
      });
      if (result?.error) {
        setError("Session handoff failed. Please try again.");
      } else {
        router.push("/dashboard/home");
      }
    } catch (err: any) {
      setError(err?.message || "Passkey sign-in failed. Please try again.");
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#000000" }}>
      <style>{`
        .login-grid { background-image: linear-gradient(rgba(196,160,80,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(196,160,80,.04) 1px,transparent 1px); }
      `}</style>
      <div className="absolute inset-0 pointer-events-none login-grid"
        style={{ backgroundSize: "60px 60px" }}
      />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10">
      <div className="w-full max-w-[460px] relative z-10">
        <div className="text-center mb-8 sm:mb-10 animate-fade-up">
          {/* Brand logo — intentionally sized wider than the "Partner Portal"
              heading below so the mark carries the page. */}
          {logoUrl && (
            <div className="mb-6 flex justify-center">
              <img
                src={logoUrl}
                alt="Fintella"
                className="w-full max-w-[380px] sm:max-w-[440px] h-auto object-contain"
              />
            </div>
          )}
          <h1 className="font-display text-[26px] sm:text-[32px] font-bold mb-3 text-white">
            Partner <span className="gold-gradient">Portal</span>
          </h1>
          <p className="font-body text-[13px] sm:text-sm text-white/75 leading-relaxed px-2 italic">
            {FIRM_SLOGAN}
          </p>
          <p className="font-body text-[12px] sm:text-[13px] text-white/55 leading-relaxed px-2 mt-2">
            View your pipeline, commissions, and downline activity.
          </p>
        </div>

        <div className="animate-fade-up-delay card rounded-2xl p-6 sm:p-8" style={{ borderColor: "rgba(196,160,80,0.18)" }}>
          <div className="flex mb-6 rounded-lg overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
            <button
              type="button"
              onClick={() => { setMode("partner"); setError(""); setArchived(false); }}
              className={`flex-1 py-3 font-body text-xs tracking-wider uppercase transition-all ${
                mode === "partner"
                  ? "bg-brand-gold/10 text-brand-gold"
                  : "theme-text-muted"
              }`}
              style={{ borderRight: "1px solid var(--app-border)" }}
            >
              Partner
            </button>
            <button
              type="button"
              onClick={() => { setMode("admin"); setError(""); setArchived(false); }}
              className={`flex-1 py-3 font-body text-xs tracking-wider uppercase transition-all ${
                mode === "admin"
                  ? "bg-brand-gold/10 text-brand-gold"
                  : "theme-text-muted"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Google sign-in shortcut — partner mode only. Admins stay on
              password auth so the separate admin role tier isn't bypassable
              by anyone with a Google account on the support email domain. */}
          {mode === "partner" && (
            <>
              <button
                type="button"
                disabled={googleLoading}
                onClick={() => {
                  setError("");
                  setGoogleLoading(true);
                  void signIn("google", { callbackUrl: "/dashboard/home" });
                }}
                className="w-full mb-5 flex items-center justify-center gap-3 rounded-lg border border-[var(--app-border)] bg-white text-gray-800 px-4 py-3 font-body text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l.1-.1 6.2 5.2C37.1 40 44 33.8 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                <span className="font-semibold">
                  {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
                </span>
              </button>
              <button
                type="button"
                disabled={passkeyLoading}
                onClick={() => void handlePasskeyLogin()}
                className="w-full mb-5 flex items-center justify-center gap-3 rounded-lg border border-brand-gold/30 bg-brand-gold/[0.05] text-[var(--app-text)] px-4 py-3 font-body text-sm hover:bg-brand-gold/[0.1] transition-colors disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#c4a050" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="9" r="4"/>
                  <path d="M13 12 L21 12 M17 12 L17 16 M21 12 L21 15"/>
                </svg>
                <span className="font-semibold">
                  {passkeyLoading ? "Waiting for passkey…" : "Sign in with a Passkey"}
                </span>
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-[var(--app-border)]" />
                <span className="font-body text-[10px] uppercase tracking-[1.5px] theme-text-muted">or sign in with email</span>
                <div className="flex-1 h-px bg-[var(--app-border)]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="font-body text-[11px] tracking-[1px] uppercase theme-text-muted mb-2 block">
                Email Address
              </label>
              <input
                type="email"
                placeholder="jane@yourfirm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full theme-input rounded-lg px-4 py-3.5 sm:py-3 font-body text-sm sm:text-[14px] outline-none focus:border-brand-gold/40 transition-colors"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="mb-7">
              <label className="font-body text-[11px] tracking-[1px] uppercase theme-text-muted mb-2 block">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full theme-input rounded-lg px-4 py-3.5 sm:py-3 font-body text-sm sm:text-[14px] outline-none focus:border-brand-gold/40 transition-colors"
              />
              <div className="text-right mt-2">
                <a
                  href="/forgot-password"
                  className="font-body text-[11px] text-brand-gold/70 hover:text-brand-gold transition-colors"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            {archived && (
              <div className="mb-5 p-4 bg-amber-500/[0.08] border border-amber-500/25 rounded-lg">
                <div className="flex items-start gap-2.5 mb-3">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 8v13H3V8"/>
                    <path d="M1 3h22v5H1z"/>
                    <path d="M10 12h4"/>
                  </svg>
                  <div>
                    <p className="font-body text-[13px] text-amber-300 font-semibold mb-1">Account Archived</p>
                    <p className="font-body text-[13px] text-amber-300/80 leading-relaxed">
                      Your account has been archived. If you&apos;d like to reactivate your account, please contact us at{" "}
                      <a href="mailto:support@fintella.partners" className="text-brand-gold underline underline-offset-2">
                        support@fintella.partners
                      </a>
                    </p>
                  </div>
                </div>
                <a
                  href="mailto:support@fintella.partners?subject=Account%20Reactivation%20Request&body=Hello%2C%0A%0AI%20would%20like%20to%20request%20reactivation%20of%20my%20partner%20account.%0A%0AThank%20you."
                  className="flex items-center justify-center gap-2 w-full rounded-lg border border-amber-500/30 bg-amber-500/[0.08] text-amber-300 px-4 py-2.5 font-body text-[13px] font-semibold hover:bg-amber-500/[0.15] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Request Reactivation
                </a>
              </div>
            )}

            {error && !archived && (
              <div className="mb-5 p-3 bg-red-500/[0.08] border border-red-500/25 rounded-lg font-body text-[13px] text-red-400 leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full rounded-md min-h-[52px]"
            >
              {loading ? "Signing In..." : mode === "partner" ? "Sign In to My Portal →" : "Sign In as Admin →"}
            </button>
          </form>

          {mode === "partner" && (
            <div className="font-body text-[11px] theme-text-faint text-center mt-4 leading-relaxed">
              Need help? Email{" "}
              <a href="mailto:support@fintella.partners" className="text-brand-gold/70 hover:text-brand-gold transition-colors">
                support@fintella.partners
              </a>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Business info footer — required for TCR A2P 10DLC compliance */}
      <footer className="relative z-10 w-full border-t border-[var(--app-border)] bg-black/60 backdrop-blur-sm py-6 px-4 sm:py-8 sm:px-6">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <div className="font-body text-[13px] text-[var(--app-text-secondary)] font-semibold">
            Fintella — Financial Intelligence Network
          </div>
          <div className="font-body text-[11px] text-[var(--app-text-muted)] leading-relaxed">
            Fintella is a B2B partner referral platform that connects customs brokers and
            trade compliance professionals with professional service firms handling IEEPA
            tariff refund recovery for U.S. importers. Operated by Annexation PR LLC.
          </div>
          <div className="font-body text-[11px] text-[var(--app-text-muted)] leading-relaxed flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0">
            <span>111 2nd Ave NE #1250, St. Petersburg, FL 33701</span>
            <span className="hidden sm:inline mx-2">·</span>
            <a href="mailto:support@fintella.partners" className="text-brand-gold/70 hover:text-brand-gold transition-colors">support@fintella.partners</a>
            <span className="hidden sm:inline mx-2">·</span>
            <a href="tel:+17274001050" className="text-brand-gold/70 hover:text-brand-gold transition-colors">(727) 400-1050</a>
          </div>
          <div className="font-body text-[11px] text-[var(--app-text-muted)] leading-relaxed">
            Fintella sends transactional SMS notifications to registered partners regarding
            account activity, agreement signing reminders, deal status updates, and commission
            notifications. Message frequency varies. Msg &amp; data rates may apply.
            Reply STOP to opt out. Reply HELP for help.
          </div>
          <div className="flex items-center justify-center gap-4 font-body text-[11px]">
            <a href="/privacy" className="text-brand-gold/70 hover:text-brand-gold transition-colors">Privacy Policy</a>
            <a href="/terms" className="text-brand-gold/70 hover:text-brand-gold transition-colors">Terms of Service</a>
          </div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)]">
            © {new Date().getFullYear()} Annexation PR LLC DBA Fintella. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
