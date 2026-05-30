import type { Metadata } from "next";
import Link from "next/link";
import { MarketingAtmosphere } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Consent Signed — IEEPA Tariff Refund",
  description: "Your consent and authorization has been signed.",
  robots: { index: false, follow: false },
};

/**
 * Post-signing landing page. Set this as the redirect URL on the dedicated
 * SignWell "Tariff Refund Workflow" API Application:
 *   https://fintella.partners/recover/tariff-diy/signed
 *
 * Signing opens in a new tab (SignWell can't be iframed), so this page just
 * confirms success and points the signer back to the original funnel tab to
 * complete the upfront payment.
 */
export default function TariffDiySignedPage() {
  return (
    <main className="oc-launch oc-grid relative overflow-hidden min-h-screen bg-[#050507] text-white flex items-center justify-center px-6">
      <MarketingAtmosphere />
      <div className="relative z-10">
        <div className="max-w-md w-full text-center rounded-2xl bg-white/[0.03] border border-white/10 p-8 backdrop-blur">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="font-display text-3xl mb-3" style={{ color: "var(--brand-gold)" }}>
            Consent signed
          </h1>
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            Thank you — your consent and authorization is complete. Return to your
            previous tab to finish the one-time file-preparation payment, or close
            this tab and we&apos;ll email you a secure payment link.
          </p>
          <Link
            href="/recover/tariff-diy?signed=1"
            className="oc-cta oc-cta--violet inline-block rounded-lg px-6 py-3 font-semibold transition"
          >
            Continue to payment →
          </Link>
        </div>
      </div>
    </main>
  );
}
