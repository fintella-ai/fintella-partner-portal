"use client";

import Link from "next/link";
import { MarketingAtmosphere, Eyebrow, GradientText } from "@/components/marketing";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "Free",
    period: "forever",
    description: "Everything you need to start recovering IEEPA tariff refunds for your clients.",
    cta: "Get Started Free",
    ctaUrl: "/apply",
    highlight: false,
    aiLabel: "Standard AI assistant",
    features: [
      "IEEPA Tariff Refund Calculator",
      "CAPE CSV File Generation",
      "Pre-Submission Audit (19 checks)",
      "Up to 10 entries per calculation",
      "1 active client dossier",
      "3 PDF client summaries per month",
      "Community support",
      "Legal referral commission",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$149",
    period: "/month",
    description: "For brokers serious about maximizing IEEPA recovery revenue across their full book.",
    cta: "Start Pro",
    ctaUrl: "/apply?plan=pro",
    highlight: true,
    badge: "Most Popular",
    aiLabel: "AI assistant + usage dashboard",
    features: [
      "Everything in Free",
      "Unlimited calculator entries",
      "Bulk CSV upload (500 entries)",
      "Unlimited client dossiers",
      "Unlimited PDF exports",
      "AI Knowledge Base search",
      "Advanced audit analytics",
      "Deadline monitoring alerts",
      "Priority email support",
      "Client summary PDF branding",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large brokerages and trade compliance firms with custom integration needs.",
    cta: "Contact Sales",
    ctaUrl: "mailto:partnerships@fintella.partners?subject=Enterprise Plan Inquiry",
    highlight: false,
    aiLabel: "Full AI governance: tool permissions, audit trail, custom prompts, daily limits",
    features: [
      "Everything in Pro",
      "AI Governance Suite",
      "REST API access for TMS integration",
      "White-label PDF branding",
      "Dedicated account manager",
      "Custom commission structure",
      "Bulk import automation",
      "SLA-backed support",
      "Custom onboarding",
    ],
  },
];

const FAQ = [
  {
    q: "What's included in the free plan?",
    a: "The full IEEPA tariff refund calculator, CAPE CSV generation, and pre-submission audit. You can run up to 10 entries per calculation, create 1 dossier, and generate 3 PDF summaries per month. Plus, you earn commission on every legal referral — free forever.",
  },
  {
    q: "How does the legal referral commission work?",
    a: "When your client needs legal review (CIT litigation, CAPE rejections, complex entries), you refer them through Fintella. Our legal partner handles the case, and you earn 10–25% of the legal fee on every successful recovery. This works on all plans, including Free.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Pro subscriptions can be canceled anytime from your portal. You'll retain Pro access until the end of your billing period. No long-term contracts, no cancellation fees.",
  },
  {
    q: "What does the calculator actually do?",
    a: "It calculates your clients' estimated IEEPA tariff refund based on their entry data (country of origin, entry date, entered value). It checks CAPE eligibility, runs a 19-point pre-submission audit, calculates 19 USC §1505 compound daily interest, and generates a clean CAPE CSV ready for ACE Portal upload.",
  },
  {
    q: "Do I need to be a licensed customs broker?",
    a: "No. Any partner can use the calculator and earn referral commissions. Licensed customs brokers get additional tools (TMS widget integration, CAPE filing workflow) but the core platform works for all partner types.",
  },
  {
    q: "Is my clients' data secure?",
    a: "Yes. All data is encrypted in transit (TLS) and at rest. We're hosted on Vercel with Neon PostgreSQL. We don't share client data with third parties. Entry data is only shared with our legal partner when you explicitly submit for legal review.",
  },
];

export default function PublicPricingPage() {
  return (
    <div
      className="oc-launch oc-grid relative overflow-hidden min-h-screen"
      style={{ background: "var(--app-bg)", color: "var(--app-text)" }}
    >
      <MarketingAtmosphere />
      <div className="relative z-10">
      {/* Header */}
      <header className="border-b backdrop-blur-sm" style={{ borderColor: "var(--app-border-subtle)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="font-display text-xl font-bold tracking-wide"
              style={{ color: "var(--brand-gold)" }}
            >
              FINTELLA
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/calculator"
              className="font-body text-sm text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
            >
              Calculator
            </Link>
            <Link
              href="/login"
              className="font-body text-sm text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/apply"
              className="font-body text-sm font-semibold px-4 py-2 rounded-lg transition-all bg-violet-600 text-white hover:bg-violet-500"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-14 text-center">
        <Eyebrow className="mb-5">Pricing</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl font-bold mb-5 tracking-tight">
          Simple, <GradientText>Transparent</GradientText> Pricing
        </h1>
        <p className="font-body text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
          Start free with our IEEPA tariff calculator. Upgrade when you need unlimited entries,
          bulk uploads, and premium features.
        </p>
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`oc-glass oc-glass--hover rounded-2xl p-6 sm:p-8 relative flex flex-col ${
                plan.highlight
                  ? "border border-violet-500/40 shadow-[0_0_50px_rgba(124,58,237,0.22)] md:-translate-y-2"
                  : ""
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-violet-600 text-white shadow-[0_4px_14px_rgba(124,58,237,0.5)]">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-body text-lg font-bold mb-1 text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span
                    className="font-display text-4xl font-bold"
                    style={{
                      color: plan.highlight ? "var(--brand-gold)" : plan.id === "free" ? "#34d399" : "var(--app-text)",
                    }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="font-body text-sm text-white/40">{plan.period}</span>
                  )}
                </div>
                <p className="font-body text-[13px] text-white/60 leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      style={{ color: f === "AI Governance Suite" ? "var(--brand-gold)" : plan.highlight ? "var(--brand-gold)" : "#34d399" }}
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {f === "AI Governance Suite" ? (
                      <span className="font-body text-[13px] font-semibold flex items-center gap-1.5 text-white">
                        {f}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-600 text-white">
                          New
                        </span>
                      </span>
                    ) : (
                      <span className="font-body text-[13px] text-white/80">{f}</span>
                    )}
                  </li>
                ))}
              </ul>

              {plan.ctaUrl.startsWith("mailto") ? (
                <a
                  href={plan.ctaUrl}
                  className="w-full h-12 rounded-xl font-body text-sm font-semibold flex items-center justify-center border border-violet-500/40 text-violet-300 transition-colors hover:bg-violet-500/10"
                >
                  {plan.cta}
                </a>
              ) : plan.highlight ? (
                <Link
                  href={plan.ctaUrl}
                  className="oc-cta oc-cta--violet w-full h-12 !rounded-xl font-body text-sm font-semibold flex items-center justify-center transition-all"
                >
                  {plan.cta}
                </Link>
              ) : (
                <Link
                  href={plan.ctaUrl}
                  className="w-full h-12 rounded-xl font-body text-sm font-semibold flex items-center justify-center border border-white/15 text-white transition-colors hover:border-white/30 hover:bg-white/5"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* AI Comparison Row */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <h2 className="font-display text-xl font-bold text-center mb-6">
          AI Assistant Comparison
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={`ai-${plan.id}`}
              className={`oc-glass rounded-xl p-5 ${
                plan.id === "enterprise"
                  ? "border border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-transparent"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-white">{plan.name}</span>
                {plan.id === "enterprise" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-600 text-white">
                    Premium
                  </span>
                )}
              </div>
              <p className="font-body text-[12px] text-white/60 leading-relaxed">
                {plan.aiLabel}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise AI Governance Explainer */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div
          className="oc-glass rounded-2xl border border-violet-500/30 p-8 sm:p-10"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(124,58,237,0.01))",
          }}
        >
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/15">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3
                className="font-display text-lg font-bold mb-2"
                style={{ color: "var(--brand-gold)" }}
              >
                Enterprise AI Governance
              </h3>
              <p className="font-body text-[13px] text-white/60 leading-relaxed mb-4">
                The only partner portal with admin-visible AI controls. Configure exactly which tools each
                AI persona can use, set daily budgets, add custom instructions, and audit every change.
                Built for compliance-first organizations.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: "🔧", label: "Tool Permissions" },
                  { icon: "📋", label: "Audit Trail" },
                  { icon: "💬", label: "Custom Prompts" },
                  { icon: "📊", label: "Daily Limits" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="font-body text-[11px] font-semibold text-white/85">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div
          className="oc-glass rounded-2xl border border-violet-500/30 p-8 sm:p-12 text-center shadow-[0_0_60px_-20px_rgba(124,58,237,0.5)]"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(124,58,237,0.01))",
          }}
        >
          <h2 className="font-display text-2xl font-bold mb-3 text-white">
            Try the Calculator Right Now
          </h2>
          <p className="font-body text-sm text-white/60 mb-6 max-w-xl mx-auto">
            No signup required. Enter your client&apos;s import data and see their estimated IEEPA refund in 30 seconds.
          </p>
          <Link
            href="/calculator"
            className="oc-cta oc-cta--violet inline-flex items-center gap-2 h-12 px-8 !rounded-xl font-body text-sm font-semibold transition-all"
          >
            Open Free Calculator
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="font-display text-2xl font-bold text-center mb-8 text-white">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="oc-glass rounded-xl group"
            >
              <summary className="p-4 sm:p-5 font-body text-sm font-semibold cursor-pointer list-none flex items-center justify-between text-white">
                {item.q}
                <svg className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 font-body text-[13px] text-white/60 leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t py-8 text-center"
        style={{ borderColor: "var(--app-border-subtle)" }}
      >
        <p className="font-body text-xs text-white/40">
          &copy; {new Date().getFullYear()} Fintella — Financial Intelligence Network. All rights reserved.
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link href="/privacy" className="font-body text-xs text-white/40 underline hover:text-white/70 transition-colors">Privacy</Link>
          <Link href="/terms" className="font-body text-xs text-white/40 underline hover:text-white/70 transition-colors">Terms</Link>
          <Link href="/calculator" className="font-body text-xs text-white/40 underline hover:text-white/70 transition-colors">Calculator</Link>
        </div>
      </footer>
      </div>
    </div>
  );
}
