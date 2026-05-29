import type { Metadata } from "next";
import Link from "next/link";
import EngageFlow from "./EngageFlow";
import { TARIFF_UPFRONT_FEE_CENTS } from "@/lib/tariff-engagement";

export const metadata: Metadata = {
  title: "DIY IEEPA Tariff Refund File — Keep 100% of Your Refund",
  description:
    "For smaller importers: we prepare a fully substantiated, audit-ready CAPE refund file for one flat fee. You submit it yourself and keep the entire refund. No contingency.",
  robots: { index: true, follow: true },
};

export default function TariffDiyPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const partnerCode = searchParams.ref || searchParams.utm_content || null;
  const tokenizationKey = process.env.NMI_TOKENIZATION_KEY || "";
  const demoMode = !tokenizationKey;
  const feeLabel = `$${(TARIFF_UPFRONT_FEE_CENTS / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  return (
    <main className="min-h-screen bg-[#060a14] text-white">
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-display text-xl" style={{ color: "#c4a050" }}>Fintella</div>
          <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition">Partner Login</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mb-6">
              For smaller importers — keep 100% of your refund
            </div>
            <h1 className="font-display text-4xl sm:text-5xl leading-tight mb-6" style={{ color: "#c4a050" }}>
              Your substantiated IEEPA refund file, done right
            </h1>
            <p className="text-lg text-white/70 mb-8 leading-relaxed">
              The big firms won&apos;t touch refunds under $1M. We will. For one flat fee we prepare a
              fully substantiated, <strong className="text-white">audit-ready CAPE file</strong> — then
              guide you to submit it yourself and keep <strong className="text-white">every dollar</strong> of the refund.
            </p>
            <div className="space-y-3 text-white/60 text-sm mb-8">
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> Human-reviewed, pre-cleared against CBP rejection codes</div>
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> One flat fee — no contingency, no cut of your refund</div>
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> Step-by-step guided self-file — you stay in control</div>
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> Deadline-aware: we flag entries before the protest window closes</div>
            </div>
            <p className="text-xs text-white/30 max-w-md leading-relaxed">
              Fintella is not a law firm and does not provide legal advice. We prepare your refund file and,
              where needed, connect you to licensed filing and legal partners. Refund estimates are not a guarantee of approval.
            </p>
          </div>

          <EngageFlow
            tokenizationKey={tokenizationKey}
            demoMode={demoMode}
            partnerCode={partnerCode}
            feeLabel={feeLabel}
          />
        </div>
      </div>
    </main>
  );
}
