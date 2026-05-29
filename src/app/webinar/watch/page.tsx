import type { Metadata } from "next";
import Link from "next/link";
import WebinarPlayer from "@/components/landing/WebinarPlayer";
import { MarketingAtmosphere, Eyebrow, GradientText, FeatureIcon } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Webinar: IEEPA Tariff Recovery Partner Opportunity | Fintella",
  robots: { index: false, follow: false },
};

export default function WebinarWatchPage({
  searchParams,
}: {
  searchParams: { name?: string };
}) {
  const firstName = searchParams.name || "there";

  return (
    <main className="oc-launch oc-grid relative overflow-hidden min-h-screen" style={{ background: "#050507" }}>
      <MarketingAtmosphere />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="border-b border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-display text-xl text-white">Fintella</Link>
            <Link href="/partners/brokers" className="text-sm text-violet-300 hover:text-violet-200 transition">Apply to Partner →</Link>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 pt-10 pb-16">
          {/* Welcome */}
          <div className="text-center mb-8">
            <div className="mb-4 flex justify-center">
              <Eyebrow>You&apos;re In — Webinar Starting Now</Eyebrow>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl mb-2 text-white">
              Welcome, <GradientText>{firstName}</GradientText>!
            </h1>
            <p className="text-sm text-white/50">Watch the full presentation below. A partner application link appears at the end.</p>
          </div>

          {/* Video player */}
          <WebinarPlayer />

          {/* Key takeaways */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="oc-glass p-5">
              <FeatureIcon className="mb-3">💰</FeatureIcon>
              <h3 className="font-semibold text-sm mb-1 text-white">Legal Referral Commissions</h3>
              <p className="text-xs text-white/50">Arizona-licensed counsel pays you directly on every successful recovery.</p>
            </div>
            <div className="oc-glass p-5">
              <FeatureIcon className="mb-3">⚡</FeatureIcon>
              <h3 className="font-semibold text-sm mb-1 text-white">Fast-Cash Buyout</h3>
              <p className="text-xs text-white/50">Clients can get 65–85 cents on the dollar in weeks. You earn on the buyout amount.</p>
            </div>
            <div className="oc-glass p-5">
              <FeatureIcon className="mb-3">🔒</FeatureIcon>
              <h3 className="font-semibold text-sm mb-1 text-white">Clients Stay Yours</h3>
              <p className="text-xs text-white/50">We never contact your clients directly. You remain their trusted advisor.</p>
            </div>
          </div>

          {/* CTA */}
          <div className="oc-glass mt-10 text-center p-8">
            <h2 className="font-display text-xl mb-3 text-white">Ready to <GradientText>Start Earning</GradientText>?</h2>
            <p className="text-sm text-white/50 mb-5">Apply to the Fintella partner program. Free to join, no obligations.</p>
            <a href="/partners/brokers" className="oc-cta oc-cta--violet">
              Apply Now — It&apos;s Free
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-white/30">
            <p>© {new Date().getFullYear()} Fintella — Financial Intelligence Network. All rights reserved.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
