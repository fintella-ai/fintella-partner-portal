import type { Metadata } from "next";
import Link from "next/link";
import EngageFlow from "./EngageFlow";
import TariffDemoShowcase from "./TariffDemoShowcase";
import SavingsCalculator from "./SavingsCalculator";
import { MarketingAtmosphere, Eyebrow, GradientText } from "@/components/marketing";
import {
  TARIFF_UPFRONT_FEE_CENTS,
  TARIFF_WIDGET_UNLOCK_FEE_CENTS,
  TARIFF_WIDGET_PER_SUBMISSION_CENTS,
  TARIFF_WIDGET_PLATFORMS,
} from "@/lib/tariff-engagement";

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

export const metadata: Metadata = {
  title: "DIY IEEPA Tariff Refund File — Don't Give Away Your Refund",
  description:
    "Don't give away your refund. We build the fully substantiated, audit-ready CAPE file. File it yourself and keep 100% — or hand it to your own customs broker or trade attorney for a review-only fee and cut their bill 75–90%.",
  robots: { index: true, follow: true },
};

const ACCENT = "#7c3aed";

export default function TariffDiyPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const partnerCode = searchParams.ref || searchParams.utm_content || null;
  const tokenizationKey = process.env.NMI_TOKENIZATION_KEY || "";
  const demoMode = !tokenizationKey;
  const feeLabel = usd(TARIFF_UPFRONT_FEE_CENTS);
  const widgetOnceLabel = usd(TARIFF_WIDGET_UNLOCK_FEE_CENTS);
  const widgetPerLabel = usd(TARIFF_WIDGET_PER_SUBMISSION_CENTS);

  return (
    <main id="top" className="oc-launch oc-grid relative overflow-hidden min-h-screen bg-[#050507] text-white">
      <MarketingAtmosphere />
      <div className="relative z-10">
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-display text-xl" style={{ color: ACCENT }}>Fintella</div>
          <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition">Partner Login</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mb-6">
              For smaller importers — keep 100% of your refund
            </div>
            <Eyebrow className="mb-4">IEEPA tariff refund · done-for-you file</Eyebrow>
            <h1 className="font-display text-4xl sm:text-5xl leading-tight mb-5 text-white">
              Don&apos;t <GradientText>give away your refund.</GradientText>
            </h1>
            <p className="text-lg text-white/70 mb-6 leading-relaxed">
              The big firms take <strong className="text-white">25–35% of your money</strong> to file a refund you
              can file yourself. We do <strong className="text-white">all the work</strong> — a fully substantiated,
              audit-ready CAPE file — then you file it and keep <strong className="text-white">every dollar</strong>.
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 mb-6">
              <p className="text-sm text-white/75 leading-relaxed">
                Already work with a customs broker or trade attorney?{" "}
                <strong className="text-white">Still use this.</strong> Hand them the finished file for a quick{" "}
                <strong className="text-white">review only</strong> — and cut their bill{" "}
                <strong style={{ color: ACCENT }}>75–90%</strong>. The work is done; all they do is sign off.
              </p>
            </div>
            <div className="space-y-3 text-white/60 text-sm mb-8">
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> Human-reviewed, pre-cleared against CBP rejection codes</div>
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> One flat fee — no contingency, no cut of your refund</div>
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> Risk analysis + missing-data report in <strong className="text-white">~30 seconds</strong></div>
              <div className="flex items-center gap-3"><span className="text-emerald-400">✓</span> File it yourself, or drop it to your broker/attorney for a review-only fee</div>
            </div>
            <p className="text-xs text-white/60 max-w-md leading-relaxed">
              Fintella is not a law firm and does not provide legal advice. We prepare your refund file and,
              where needed, connect you to licensed filing and legal partners. Refund estimates are not a guarantee of approval.
            </p>
          </div>

          <EngageFlow
            tokenizationKey={tokenizationKey}
            demoMode={demoMode}
            partnerCode={partnerCode}
            feeLabel={feeLabel}
            widgetOnceLabel={widgetOnceLabel}
            widgetPerLabel={widgetPerLabel}
            platforms={TARIFF_WIDGET_PLATFORMS}
          />
        </div>
      </div>

      {/* ── Live engine demo ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase bg-white/5 text-white/50 border border-white/10 mb-4">
            Watch it work
          </div>
          <h2 className="font-display text-3xl sm:text-4xl mb-3 text-white">
            Drop an entry summary. <GradientText>Get a risk analysis in seconds.</GradientText>
          </h2>
          <p className="text-white/60">
            Our Tariff Intelligence Engine reads your CBP Form 7501, extracts every field with a confidence score,
            flags anything missing, and runs a pre-submission audit against CBP rejection codes — before you ever pay.
          </p>
        </div>
        <TariffDemoShowcase />
      </section>

      {/* ── Savings calculator (exclaim the result) ──────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="font-display text-3xl sm:text-4xl mb-3 text-white">
            What others charge 30% for, <GradientText>you keep.</GradientText>
          </h2>
          <p className="text-white/60">
            Slide to your refund. See what a contingency firm would take — and what you keep when you pay a small
            flat fee for the work and the software instead.
          </p>
        </div>
        <SavingsCalculator upfrontFeeCents={TARIFF_UPFRONT_FEE_CENTS} />
      </section>

      {/* ── Try → Prove → Commit ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: ACCENT }}>
            No leap of faith. Prove it on one file first.
          </h2>
          <p className="text-white/60">See the analysis before you pay. Pay to prove a single file. Commit only once you&apos;re satisfied.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { n: "1", t: "Try it — free", d: "Run your entries and see your gated results: eligibility, deadlines, and a risk analysis. The refund dollar amount stays locked until you proceed.", tag: "free" },
            { n: "2", t: "Prove one file", d: "Pay to unlock your first file and inspect the real, substantiated work — the analysis, the CAPE entry, the audit. Check it line by line.", tag: "1 file" },
            { n: "3", t: "Commit when satisfied", d: "Happy with the first file? Unlock the rest at volume pricing. If you have more entries, the remainder is one click away.", tag: "the rest" },
          ].map((s) => (
            <div key={s.n} className="oc-glass oc-glass--hover rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-full font-bold text-sm" style={{ background: ACCENT, color: "#fff" }}>{s.n}</div>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider bg-white/5 text-white/50 border border-white/10">{s.tag}</span>
              </div>
              <div className="font-semibold text-white/90 mb-1.5">{s.t}</div>
              <p className="text-sm text-white/55 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cost comparison ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: ACCENT }}>
            Same refund. Keep far more of it.
          </h2>
          <p className="text-white/60">Three ways to file — you stay in control of every one.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Contingency firm */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Contingency firm</div>
            <div className="text-3xl font-bold text-red-300 mb-1">25–35%</div>
            <div className="text-xs text-white/40 mb-4">of your refund — gone</div>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex gap-2"><span className="text-red-300">✕</span> They keep a cut of every dollar</li>
              <li className="flex gap-2"><span className="text-red-300">✕</span> Won&apos;t touch refunds under $1M</li>
              <li className="flex gap-2"><span className="text-white/30">—</span> You wait on their queue</li>
            </ul>
          </div>
          {/* DIY flat fee — featured */}
          <div className="rounded-2xl border-2 p-6 relative" style={{ borderColor: ACCENT, background: "rgba(124,58,237,0.10)", boxShadow: "0 0 40px -8px rgba(124,58,237,0.45)" }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ background: ACCENT, color: "#fff" }}>
              Most keep 100%
            </div>
            <div className="text-xs uppercase tracking-wider text-white/50 mb-2">DIY — file it yourself</div>
            <div className="text-3xl font-bold mb-1" style={{ color: ACCENT }}>{feeLabel}</div>
            <div className="text-xs text-white/40 mb-4">flat fee · keep 100% of the refund</div>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex gap-2"><span className="text-emerald-400">✓</span> We do all the work — you keep the refund</li>
              <li className="flex gap-2"><span className="text-emerald-400">✓</span> Audit-ready, pre-cleared file + guided self-file</li>
              <li className="flex gap-2"><span className="text-emerald-400">✓</span> No contingency, no cut, ever</li>
            </ul>
          </div>
          {/* Broker / attorney review-only */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Your broker / attorney</div>
            <div className="text-3xl font-bold text-emerald-300 mb-1">−75–90%</div>
            <div className="text-xs text-white/40 mb-4">off their normal bill</div>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex gap-2"><span className="text-emerald-400">✓</span> Keep your trusted advisor in the loop</li>
              <li className="flex gap-2"><span className="text-emerald-400">✓</span> They <strong className="text-white/80">review</strong>, not rebuild — the work&apos;s done</li>
              <li className="flex gap-2"><span className="text-emerald-400">✓</span> Pay for a sign-off, not billable hours</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Sample client report ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase bg-white/5 text-white/50 border border-white/10 mb-4">
              What you hand over
            </div>
            <h2 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: ACCENT }}>
              A file your broker or attorney can sign off in minutes.
            </h2>
            <p className="text-white/65 mb-5 leading-relaxed">
              Every refund comes back as a clean, substantiated package — the recovery analysis, the CAPE
              declaration, and a step-by-step self-file guide. It&apos;s the same dossier a contingency firm would
              build, formatted so a reviewer can verify it fast instead of starting from scratch.
            </p>
            <ul className="space-y-2.5 text-sm text-white/65">
              <li className="flex gap-3"><span style={{ color: ACCENT }}>›</span> Recovery analysis (PDF) — entries, eligibility, refund + interest</li>
              <li className="flex gap-3"><span style={{ color: ACCENT }}>›</span> CAPE declaration (CSV) — ready to submit</li>
              <li className="flex gap-3"><span style={{ color: ACCENT }}>›</span> Pre-submission audit — every CBP rejection-code check, passed</li>
              <li className="flex gap-3"><span style={{ color: ACCENT }}>›</span> Guided self-file walkthrough — step by step</li>
            </ul>
          </div>
          {/* Mocked report sheet */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2 backdrop-blur">
            <div className="rounded-xl bg-[#0c0c10] border border-white/10 p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <div className="font-display text-lg" style={{ color: ACCENT }}>IEEPA Refund Recovery Analysis</div>
                  <div className="text-[11px] text-white/40">Prepared by Fintella · Sample</div>
                </div>
                <div className="text-[10px] rounded px-2 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-semibold">AUDIT-READY</div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-white/[0.03] p-3 text-center"><div className="text-lg font-bold" style={{ color: ACCENT }}>$26,455</div><div className="text-[10px] text-white/40">est. refund</div></div>
                <div className="rounded-lg bg-white/[0.03] p-3 text-center"><div className="text-lg font-bold text-white/80">$1,842</div><div className="text-[10px] text-white/40">est. interest</div></div>
                <div className="rounded-lg bg-white/[0.03] p-3 text-center"><div className="text-lg font-bold text-emerald-400">3 / 3</div><div className="text-[10px] text-white/40">eligible</div></div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/35 mb-2">Entries</div>
              <div className="space-y-1.5 mb-4">
                {[
                  ["CBP-31548820-9", "CN", "$182,450"],
                  ["CBP-31602117-4", "CN", "$94,200"],
                  ["CBP-31655908-1", "VN", "$61,780"],
                ].map(([no, co, val]) => (
                  <div key={no} className="flex items-center justify-between text-xs rounded-lg bg-white/[0.02] px-3 py-2">
                    <span className="font-mono text-white/70">{no}</span>
                    <span className="text-white/40">{co}</span>
                    <span className="text-white/80">{val}</span>
                    <span className="text-emerald-400">✓</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-[11px] text-emerald-200">
                ✓ All entries within IEEPA window · protest deadlines flagged · 0 CBP rejection-code errors
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works / time-to-result ────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12 pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: ACCENT }}>From entries to filed in three steps</h2>
          <p className="text-white/60">Most importers go from upload to a substantiated file the same day.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { n: "1", t: "Drop your entries", d: "Add your import entries or your CBP Form 7501. The engine extracts every field and flags anything missing — in about 30 seconds.", tag: "~30 sec" },
            { n: "2", t: "We build the file", d: "We prepare a fully substantiated, audit-ready CAPE file, pre-cleared against CBP rejection codes. One flat fee — no cut of your refund.", tag: "same day" },
            { n: "3", t: "File it — or hand it off", d: "Submit it yourself and keep 100%, or drop the finished file to your customs broker or trade attorney for a review-only sign-off.", tag: "keep 100%" },
          ].map((s) => (
            <div key={s.n} className="oc-glass oc-glass--hover rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-full font-bold text-sm" style={{ background: ACCENT, color: "#fff" }}>{s.n}</div>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider bg-white/5 text-white/50 border border-white/10">{s.tag}</span>
              </div>
              <div className="font-semibold text-white/90 mb-1.5">{s.t}</div>
              <p className="text-sm text-white/55 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            href="#top"
            className="inline-block rounded-full px-8 py-3.5 font-semibold transition min-h-[44px] hover:opacity-90"
            style={{ background: ACCENT, color: "#fff", boxShadow: "0 0 32px -6px rgba(124,58,237,0.55)" }}
          >
            Check your refund — free →
          </Link>
          <p className="text-xs text-white/60 mt-3">No obligation · estimate only, not a guarantee of approval</p>
        </div>
      </section>
      </div>
    </main>
  );
}
