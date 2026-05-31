import MfaEnforcementGate from "@/components/auth/MfaEnforcementGate";

/**
 * Route-group parent layout for the admin area ((admin)/admin/*). Wraps
 * everything in the MFA enforcement gate; the gate asks the server which portal
 * applies based on the session role, so a credentials-logged-in admin gets the
 * admin enroll flow. Google-authenticated admins and existing sessions pass
 * straight through. (The Ops Center lives in its own (ops) group and is not
 * gated here — it's shared by partners and admins.)
 */
export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return <MfaEnforcementGate>{children}</MfaEnforcementGate>;
}
