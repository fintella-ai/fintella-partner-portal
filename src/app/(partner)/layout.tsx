import MfaEnforcementGate from "@/components/auth/MfaEnforcementGate";

/**
 * Route-group parent layout for the partner portal. Its only job is to wrap
 * everything under (partner) in the MFA enforcement gate — when partner MFA is
 * required and a credentials-logged-in partner hasn't enrolled, they get the
 * mandatory enrollment screen instead of the dashboard. Google / passkey /
 * existing sessions pass straight through. The real dashboard chrome lives in
 * (partner)/dashboard/layout.tsx, which renders untouched as children here.
 */
export default function PartnerGroupLayout({ children }: { children: React.ReactNode }) {
  return <MfaEnforcementGate>{children}</MfaEnforcementGate>;
}
