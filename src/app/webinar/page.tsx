import type { Metadata } from "next";
import Link from "next/link";
import WebinarRegistrationForm from "@/components/landing/WebinarRegistrationForm";
import { MarketingAtmosphere, Eyebrow, GradientText } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Free Webinar: How Customs Brokers Earn on IEEPA Tariff Recoveries | Fintella",
  description: "Watch this free 15-minute presentation to learn how licensed customs brokers earn referral commissions on every IEEPA tariff recovery. Starts in minutes.",
  robots: { index: true, follow: true },
};

export default function WebinarSqueezePage() {
  return (
    <main className="oc-launch oc-grid relative overflow-hidden min-h-screen" style={{ background: "#050507" }}>
      <MarketingAtmosphere />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="border-b border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-display text-xl text-white">Fintella</Link>
            <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition">Partner Login</Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div>
              <Eyebrow className="mb-5">Free On-Demand Webinar</Eyebrow>
              <h1 className="font-display text-3xl sm:text-4xl leading-tight mb-6 text-white">
                How Customs Brokers <GradientText>Earn Commissions</GradientText> on Every IEEPA Tariff Recovery
              </h1>
              <p className="text-lg text-white/60 mb-6 leading-relaxed">
                In this free 15-minute presentation, you&apos;ll learn exactly how licensed customs brokers are turning their existing client relationships into a new revenue stream — legally and compliantly.
              </p>

              <div className="space-y-3 text-white/60 text-sm mb-8">
                <div className="flex items-start gap-3">
                  <span className="text-violet-300 mt-0.5">✓</span>
                  <span>Why $166 billion in IEEPA refunds creates a massive opportunity for brokers</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-violet-300 mt-0.5">✓</span>
                  <span>How Arizona law allows our legal partner to pay you referral commissions</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-violet-300 mt-0.5">✓</span>
                  <span>The exact process: refer → we file → client gets refund → you get paid</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-violet-300 mt-0.5">✓</span>
                  <span>How the fast-cash buyout option gets your clients paid in weeks</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-violet-300 mt-0.5">✓</span>
                  <span>Real numbers: commission rates, deal sizes, and earning potential</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-white/40">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏱️</span>
                  <span>15 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎥</span>
                  <span>Watch instantly</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <span>100% Free</span>
                </div>
              </div>
            </div>

            {/* Right: Registration Form */}
            <div>
              <WebinarRegistrationForm />
            </div>
          </div>
        </div>

        {/* Social proof / trust */}
        <div className="border-t border-white/5 bg-white/[0.02]">
          <div className="max-w-5xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              <div>
                <div className="oc-stat-value font-display">$166B</div>
                <div className="text-xs text-white/40 mt-1">In IEEPA Refunds Available</div>
              </div>
              <div>
                <div className="oc-stat-value font-display">14,454</div>
                <div className="text-xs text-white/40 mt-1">Licensed US Customs Brokers</div>
              </div>
              <div>
                <div className="oc-stat-value font-display">83%</div>
                <div className="text-xs text-white/40 mt-1">Of Importers Haven&apos;t Filed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-white/30">
            <p>© {new Date().getFullYear()} Fintella — Financial Intelligence Network. All rights reserved.</p>
            <div className="mt-3 flex justify-center gap-4">
              <Link href="/privacy" className="hover:text-white/50 transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white/50 transition">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
