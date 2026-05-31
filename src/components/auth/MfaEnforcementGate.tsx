"use client";

import { useCallback, useEffect, useState } from "react";
import ForcedTwoFactorEnroll from "@/components/auth/ForcedTwoFactorEnroll";

/**
 * Client wrapper that enforces MFA enrollment for credentials-logged-in users
 * when the per-portal toggle is ON. Mounted by the (partner) and (admin)
 * route-group layouts so it wraps the whole portal.
 *
 * It asks the server (/api/auth/mfa-status) whether THIS session must enroll —
 * the server owns the "Google-OR-TOTP" logic (see src/lib/mfa-gate.ts), so this
 * component never has to reason about providers. Defaults to letting the user
 * through (renders children) on loading or any error — fail-open, because the
 * login-time TOTP gate already protects already-enrolled accounts, and we never
 * want to lock a user out of a working session over a network blip.
 */
export default function MfaEnforcementGate({ children }: { children: React.ReactNode }) {
  const [enroll, setEnroll] = useState<{ portal: "partner" | "admin" } | null>(null);

  const check = useCallback(() => {
    fetch("/api/auth/mfa-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mustEnroll: false }))
      .then((d) => setEnroll(d.mustEnroll && d.portal ? { portal: d.portal } : null))
      .catch(() => setEnroll(null));
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (enroll) {
    const meta =
      enroll.portal === "admin"
        ? { apiPath: "/api/admin/2fa", label: "admin dashboard" }
        : { apiPath: "/api/partner/2fa", label: "partner portal" };
    return (
      <ForcedTwoFactorEnroll apiPath={meta.apiPath} portalLabel={meta.label} onComplete={check} />
    );
  }

  return <>{children}</>;
}
