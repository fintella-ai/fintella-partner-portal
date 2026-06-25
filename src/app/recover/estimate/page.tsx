import type { Metadata } from "next";
import Link from "next/link";
import RecoverFormReordered from "@/components/landing/RecoverFormReordered";

export const metadata: Metadata = {
  title: "Estimate Your 2025 IEEPA Tariff Refund — Fintella",
  description: "Start with what you paid in 2025. Enter your IEEPA tariff duties and get an instant refund estimate in 60 seconds.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Estimate Your 2025 IEEPA Tariff Refund",
    description: "Enter your 2025 IEEPA duties and see your potential refund + interest instantly.",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default async function RecoverEstimatePage({
  searchParams,
}: {
  searchParams: { ref?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };
}) {
  const partnerCode = searchParams.ref || searchParams.utm_content || null;
  const sp = searchParams as Record<string, string | undefined>;
  const utmParams = {
    utm_source: sp.utm_source || null,
    utm_medium: sp.utm_medium || null,
    utm_campaign: sp.utm_campaign || null,
    utm_content: sp.utm_content || null,
    utm_term: sp.utm_term || null,
    utm_adgroup: sp.utm_adgroup || null,
  };

  return (
    <main className="min-h-screen bg-[#060a14] text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-white/5">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-display text-xl" style={{ color: "#c4a050" }}>Fintella</div>
          <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition">Partner Login</Link>
        </div>
      </nav>

      {/* Centered form */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20 mb-5">
            IEEPA Tariff Refund
          </div>
          <h1 className="font-display text-3xl sm:text-4xl leading-tight mb-3" style={{ color: "#c4a050" }}>
            Estimate Your 2025 Tariff Refund
          </h1>
          <p className="text-white/60 text-sm sm:text-base leading-relaxed">
            Start with what you paid in 2025 — get an instant refund estimate in about 60 seconds.
          </p>
        </div>

        <RecoverFormReordered partnerCode={partnerCode} utmParams={utmParams} />
      </div>

      {/* Footer */}
      <div className="border-t border-white/5">
        <div className="max-w-2xl mx-auto px-6 py-8 text-center text-xs text-white/55">
          <p>© {new Date().getFullYear()} Fintella — a DBA of Annexation PR LLC. All rights reserved.</p>
          <p className="mt-2">Refund estimates are illustrative and not a guarantee of recovery. Eligibility is confirmed during your free assessment.</p>
          <div className="mt-3 flex justify-center gap-4">
            <Link href="/privacy" className="hover:text-white/50 transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/50 transition">Terms</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
