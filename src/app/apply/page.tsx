"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MarketingAtmosphere, Eyebrow, GradientText } from "@/components/marketing";

function ApplyForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [partnerType, setPartnerType] = useState("customs_broker");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName || !email) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          companyName: companyName || undefined,
          website: website || undefined,
          partnerType: partnerType || undefined,
          referralSource: plan ? `pricing_${plan}` : "apply_page",
          utm_source: searchParams.get("utm_source") || undefined,
          utm_medium: searchParams.get("utm_medium") || undefined,
          utm_campaign: searchParams.get("utm_campaign") || undefined,
          utm_content: searchParams.get("utm_content") || undefined,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.alreadyPartner) {
          setError("You already have a partner account. Sign in to your portal.");
        } else if (data.alreadyApplied) {
          setError("Application already received. We'll be in touch soon.");
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="oc-launch oc-grid relative overflow-hidden min-h-screen flex items-center justify-center px-4">
        <MarketingAtmosphere />
        <div className="relative z-10 max-w-md w-full text-center">
          <div className="oc-feature-icon mx-auto mb-5">🎉</div>
          <Eyebrow className="justify-center mb-3">Welcome aboard</Eyebrow>
          <h1 className="font-display text-3xl font-bold mb-3 text-white">
            Application <GradientText>Received</GradientText>
          </h1>
          <p className="font-body text-sm mb-6 text-white/60">
            Thank you, {firstName}! We&apos;ll review your application and be in touch within 24 hours.
            In the meantime, try our free calculator.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/calculator"
              className="btn-gold h-11 rounded-xl font-body text-sm font-semibold flex items-center justify-center"
            >
              Try the Free Calculator
            </Link>
            <Link
              href="/partners/brokers"
              className="h-11 rounded-xl font-body text-sm font-medium flex items-center justify-center border border-white/15 text-white/60 transition-colors hover:text-white hover:border-white/30"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="oc-launch oc-grid relative overflow-hidden min-h-screen">
      <MarketingAtmosphere />
      <div className="relative z-10">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-wide text-white"
          >
            FINTELLA
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/calculator" className="font-body text-sm text-white/60 transition-colors hover:text-white">
              Calculator
            </Link>
            <Link href="/login" className="font-body text-sm text-white/60 transition-colors hover:text-white">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left — Value prop */}
        <div className="py-8">
          <Eyebrow className="mb-4">Free to Join — No Risk</Eyebrow>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4 text-white leading-tight">
            Become a <GradientText>Fintella Partner</GradientText>
          </h1>
          <p className="font-body text-base mb-8 text-white/60">
            Join the network of customs brokers and professionals earning 10-25% commission
            on every IEEPA tariff recovery. Free tools, no cost to join, your clients stay yours.
          </p>

          <div className="space-y-4 mb-8">
            {[
              { icon: "🧮", title: "Free IEEPA Calculator", desc: "Instant refund estimates for your clients" },
              { icon: "📄", title: "AI Document Intake", desc: "Drop a CF 7501 — get results in 30 seconds" },
              { icon: "💰", title: "10-25% Commission", desc: "Earn on every successful recovery" },
              { icon: "🔌", title: "TMS Widget", desc: "Embed directly in CargoWise or Magaya" },
              { icon: "📊", title: "Full Reporting", desc: "Track deals, commissions, and downline" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="oc-feature-icon shrink-0">{item.icon}</span>
                <div className="pt-1">
                  <div className="font-body text-sm font-semibold text-white">{item.title}</div>
                  <div className="font-body text-xs text-white/50">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="oc-glass rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">💎</span>
            <div>
              <div className="oc-stat-value font-body text-sm font-semibold">
                $166 Billion Available
              </div>
              <div className="font-body text-xs text-white/50">
                83% of eligible importers haven&apos;t filed. The clock is ticking.
              </div>
            </div>
          </div>
        </div>

        {/* Right — Form */}
        <div>
          <div className="oc-glass rounded-2xl p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold mb-1 text-white">
              Apply Now
            </h2>
            <p className="font-body text-xs mb-6 text-white/50">
              We&apos;ll review your application and get back to you within 24 hours.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm font-body bg-red-500/10 text-red-400 border border-red-500/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-body text-[10px] uppercase tracking-wider mb-1.5 text-white/50">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full h-11 rounded-lg border border-white/15 bg-white/5 px-3 font-body text-sm text-white placeholder-white/30 transition-colors focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  />
                </div>
                <div>
                  <label className="block font-body text-[10px] uppercase tracking-wider mb-1.5 text-white/50">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full h-11 rounded-lg border border-white/15 bg-white/5 px-3 font-body text-sm text-white placeholder-white/30 transition-colors focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-body text-[10px] uppercase tracking-wider mb-1.5 text-white/50">
                  Business Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 rounded-lg border border-white/15 bg-white/5 px-3 font-body text-sm text-white placeholder-white/30 transition-colors focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>

              <div>
                <label className="block font-body text-[10px] uppercase tracking-wider mb-1.5 text-white/50">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 rounded-lg border border-white/15 bg-white/5 px-3 font-body text-sm text-white placeholder-white/30 transition-colors focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>

              <div>
                <label className="block font-body text-[10px] uppercase tracking-wider mb-1.5 text-white/50">
                  Company
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full h-11 rounded-lg border border-white/15 bg-white/5 px-3 font-body text-sm text-white placeholder-white/30 transition-colors focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>

              <div>
                <label className="block font-body text-[10px] uppercase tracking-wider mb-1.5 text-white/50">
                  I am a...
                </label>
                <select
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value)}
                  className="w-full h-11 rounded-lg border border-white/15 bg-white/5 px-3 font-body text-sm text-white transition-colors focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40 [&>option]:bg-[#0d0d12] [&>option]:text-white"
                >
                  <option value="customs_broker">Licensed Customs Broker</option>
                  <option value="referral">Referral Partner</option>
                  <option value="corporate">Corporate / Enterprise</option>
                  <option value="licensed">Attorney / CPA</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || !firstName || !lastName || !email}
                className="btn-gold w-full h-12 rounded-xl font-body text-sm font-semibold transition-all disabled:opacity-40"
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </form>

            <p className="font-body text-[10px] text-center mt-4 text-white/40">
              By applying, you agree to our{" "}
              <Link href="/terms" className="underline transition-colors hover:text-white/70">Terms</Link> and{" "}
              <Link href="/privacy" className="underline transition-colors hover:text-white/70">Privacy Policy</Link>.
              We&apos;ll never share your information.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="oc-launch oc-grid relative overflow-hidden min-h-screen flex items-center justify-center bg-[#050507]">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-white/10 border-t-violet-500" />
        </div>
      }
    >
      <ApplyForm />
    </Suspense>
  );
}
