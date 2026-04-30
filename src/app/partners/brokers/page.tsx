import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TMS Widget for Customs Brokers — Turn Every Shipment Into Revenue | Fintella",
  description: "Embed Fintella's referral widget directly in CargoWise or Magaya. Earn commissions on IEEPA tariff recoveries without leaving your TMS.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "TMS Widget for Customs Brokers — Fintella",
    description: "Earn commissions on every IEEPA recovery. 5-minute setup, works inside CargoWise & Magaya.",
    type: "website",
  },
};

export default function BrokersLandingPage() {
  return (
    <main className="min-h-screen bg-[#060a14] text-white overflow-hidden">
      {/* Nav */}
      <nav className="border-b border-white/5 relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl" style={{ color: "#c4a050" }}>Fintella</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition">Partner Login</Link>
            <Link href="/apply" className="text-sm font-semibold px-5 py-2 rounded-full transition" style={{ background: "#c4a050", color: "#060a14" }}>
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — Full width, aggressive */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #c4a050 0%, transparent 70%)" }} />
          <div className="absolute -bottom-60 -left-40 w-[500px] h-[500px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #c4a050 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block rounded-full px-5 py-2 text-xs font-bold tracking-widest uppercase mb-8" style={{ background: "rgba(196, 160, 80, 0.15)", color: "#f0d070", border: "1px solid rgba(196, 160, 80, 0.3)" }}>
              5-Minute Setup &bull; Works Inside Your TMS
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mb-8 tracking-tight">
              <span style={{ color: "#c4a050" }}>Every Shipment</span>
              <br />
              <span className="text-white">Is a Revenue Opportunity</span>
              <br />
              <span className="text-white/40 text-4xl sm:text-5xl lg:text-5xl">You&apos;re Just Not Capturing It Yet.</span>
            </h1>

            <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
              Embed Fintella&apos;s referral widget directly inside CargoWise or Magaya. See a client&apos;s duties, submit a referral, earn commission — without ever leaving your TMS.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/apply" className="text-lg font-bold px-10 py-4 rounded-full transition-transform hover:scale-105 active:scale-95" style={{ background: "linear-gradient(135deg, #c4a050 0%, #f0d070 100%)", color: "#060a14" }}>
                Get the Widget Free
              </Link>
              <a href="#demo" className="text-lg font-medium px-10 py-4 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition">
                Watch 60-Second Demo
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { value: "$166B", label: "IEEPA Refunds Available" },
              { value: "83%", label: "Of Importers Haven't Filed" },
              { value: "5 Min", label: "Widget Setup Time" },
              { value: "25%", label: "Commission Rate" },
            ].map((s) => (
              <div key={s.label} className="text-center p-4 rounded-xl" style={{ background: "rgba(196, 160, 80, 0.05)", border: "1px solid rgba(196, 160, 80, 0.15)" }}>
                <div className="font-display text-3xl font-bold mb-1" style={{ color: "#f0d070" }}>{s.value}</div>
                <div className="text-xs text-white/40 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="demo" className="py-20" style={{ background: "linear-gradient(180deg, #060a14 0%, #0c1220 50%, #060a14 100%)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: "#c4a050" }}>
              See It in Action
            </h2>
            <p className="text-white/50 text-lg">60 seconds. That&apos;s all it takes to understand why this changes everything.</p>
          </div>

          {/* Video placeholder — replace with actual video embed */}
          <div className="relative aspect-video max-w-4xl mx-auto rounded-2xl overflow-hidden" style={{ border: "2px solid rgba(196, 160, 80, 0.3)", background: "#0a0e18" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 mx-auto cursor-pointer hover:scale-110 transition-transform" style={{ background: "rgba(196, 160, 80, 0.2)", border: "2px solid #c4a050" }}>
                  <span className="text-3xl ml-1">&#9654;</span>
                </div>
                <div className="text-white/40 text-sm">TMS Widget Demo — Coming Soon</div>
                <div className="text-white/20 text-xs mt-1">Record in CargoWise showing the full refer &rarr; earn flow</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — 3 steps */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: "#c4a050" }}>
              Three Steps. Zero Disruption.
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">You don&apos;t change how you work. You just get paid for what you already see.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Install the Widget",
                description: "Add a Custom Panel in CargoWise or Magaya. Paste one URL. Done in 5 minutes.",
                icon: "🔌",
              },
              {
                step: "02",
                title: "Spot the Opportunity",
                description: "You see a client paying IEEPA duties. Open the widget, fill in their info, submit. 30 seconds.",
                icon: "👁️",
              },
              {
                step: "03",
                title: "Earn Commission",
                description: "Our legal team files the recovery. Client gets their refund. You get up to 25% of the firm fee. Direct deposit.",
                icon: "💰",
              },
            ].map((item) => (
              <div key={item.step} className="relative p-8 rounded-2xl" style={{ background: "rgba(196, 160, 80, 0.04)", border: "1px solid rgba(196, 160, 80, 0.12)" }}>
                <div className="font-display text-6xl font-bold absolute top-4 right-6 opacity-5" style={{ color: "#c4a050" }}>{item.step}</div>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-display text-xl font-semibold mb-3 text-white">{item.title}</h3>
                <p className="text-white/50 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEAR: This Is Going to Litigation */}
      <section className="py-20" style={{ background: "#0c1220" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-widest uppercase mb-6" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
              Reality Check
            </div>
            <h2 className="font-display text-3xl sm:text-4xl mb-4 text-white">
              This Is Heading to <span style={{ color: "#f87171" }}>Litigation</span>. Your Clients Need Counsel.
            </h2>
            <p className="text-white/50 text-lg max-w-3xl mx-auto">
              The Supreme Court struck down IEEPA tariffs. CBP launched a portal. But the government is pushing back, deadlines are expiring, and most importers are walking into a legal minefield without a lawyer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                num: "01",
                title: "CAPE Is a Filing Tool — Not a Legal Strategy",
                body: "CBP’s portal lets importers upload a CSV of entry numbers. It does not reconcile cross-broker data, isolate IEEPA duties from stacked 301/232 tariffs, monitor per-entry deadlines, review compliance history, or defend against audits. One bad entry can reject the entire declaration. No amendments. No second chances.",
              },
              {
                num: "02",
                title: "180-Day Deadlines Are Expiring Right Now",
                body: "Under 19 U.S.C. § 1514, every import entry has its own 180-day protest clock after liquidation. Miss it and that entry’s refund is gone permanently — “final and conclusive upon all parties.” Entries from early 2025 are hitting this cliff today. Not next quarter. Today.",
              },
              {
                num: "03",
                title: "Finally Liquidated Entries Require Federal Court",
                body: "CAPE Phase 1 explicitly excludes finally liquidated entries. For those, the only path to recovery is filing suit at the U.S. Court of International Trade. Only licensed attorneys can represent business entities in CIT. Self-filers and brokers cannot. The outside filing deadline is approximately February 2027.",
              },
              {
                num: "04",
                title: "The Government Will Offset Your Client’s Refund",
                body: "CBP can reduce IEEPA refunds by netting them against outstanding Section 301 or Section 232 liabilities. Self-filers have zero mechanism to challenge these offsets. Legal counsel actively defends against improper netting to preserve the full refund amount.",
              },
              {
                num: "05",
                title: "Filing Without Compliance Review Invites CBP Scrutiny",
                body: "Many importers reclassified goods or adjusted valuations during the tariff period. Filing a refund claim flags those entries for CBP review. Without a compliance audit before submission, importers risk triggering penalties under 19 U.S.C. § 1592 — up to 4x the unpaid duties for gross negligence.",
              },
              {
                num: "06",
                title: "Only Attorneys Protect What Your Clients Disclose",
                body: "If your client tells you they reclassified goods to reduce tariff exposure, that conversation is discoverable by CBP. Attorney-client privilege exists specifically to protect these discussions. A consultant, broker, or filing service offers no privilege. What your client tells them can become evidence.",
              },
            ].map((item) => (
              <div key={item.num} className="p-6 rounded-xl" style={{ background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
                <div className="font-mono text-[11px] font-bold mb-2" style={{ color: "#f87171" }}>{item.num}</div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 rounded-xl text-center" style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <div className="font-display text-xl font-semibold text-white mb-2">
              1,000+ importers have already filed CIT cases.
            </div>
            <div className="text-white/40 text-sm">
              The lead case is <span className="text-white/60 font-medium">Euro-Notions Florida v. United States</span> (Court No. 25-595). The court is supervising CBP&apos;s entire CAPE development. This is active federal litigation — not a government handout.
            </div>
          </div>
        </div>
      </section>

      {/* GREED: Why Referring Beats DIY */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-widest uppercase mb-6" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
              The Smart Play
            </div>
            <h2 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: "#c4a050" }}>
              Refer. Don&apos;t File. Earn More. Risk Nothing.
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              You could try to handle IEEPA recoveries yourself. Or you could hand it to a top-tier Arizona firm, earn a bigger payout, and carry zero liability.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Column: DIY */}
            <div className="p-8 rounded-2xl" style={{ background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
              <div className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#f87171" }}>If You Handle It Yourself</div>
              <div className="space-y-4">
                {[
                  "You’re the declarant of record — you own every error",
                  "No attorney-client privilege on client disclosures",
                  "You can’t represent clients in CIT if claims are denied",
                  "No defense mechanism against government offsets",
                  "You monitor deadlines across hundreds of entries",
                  "One CAPE mistake = no amendment, no second filing",
                  "You earn nothing beyond your standard brokerage fee",
                ].map((line) => (
                  <div key={line} className="flex items-start gap-3">
                    <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                    <span className="text-white/45 text-sm">{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column: Refer */}
            <div className="p-8 rounded-2xl" style={{ background: "rgba(196, 160, 80, 0.06)", border: "1px solid rgba(196, 160, 80, 0.2)" }}>
              <div className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#f0d070" }}>If You Refer Through Fintella</div>
              <div className="space-y-4">
                {[
                  "Zero liability — the law firm is counsel of record",
                  "Full attorney-client privilege protects your clients",
                  "CIT litigation handled if claims are denied or excluded",
                  "Active defense against government offset attempts",
                  "Legal team monitors every deadline across every entry",
                  "Compliance review before anything goes to CBP",
                  "You earn up to 25% of the firm fee on every recovery",
                ].map((line) => (
                  <div key={line} className="flex items-start gap-3">
                    <span style={{ color: "#f0d070" }} className="shrink-0 mt-0.5">&#10003;</span>
                    <span className="text-white/60 text-sm">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Firm */}
      <section className="py-20" style={{ background: "#0c1220" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: "#c4a050" }}>
              A Team Built for This Exact Moment
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Trade attorneys, licensed customs brokers, tax counsel, and dedicated project managers. Billions recovered. Contingency-based. Arizona-licensed — legally authorized to pay you referral commissions.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { icon: "⚖️", title: "Trade Attorneys", sub: "IEEPA, Section 301/232, CIT litigation" },
              { icon: "📦", title: "Licensed Customs Brokers", sub: "ACE data reconciliation, entry verification" },
              { icon: "📊", title: "Tax Attorneys", sub: "Classification, valuation, compliance review" },
              { icon: "📋", title: "Project Managers", sub: "Deadline tracking, client communication" },
            ].map((t) => (
              <div key={t.title} className="text-center p-5 rounded-xl" style={{ background: "rgba(196, 160, 80, 0.04)", border: "1px solid rgba(196, 160, 80, 0.1)" }}>
                <div className="text-3xl mb-3">{t.icon}</div>
                <div className="font-semibold text-white text-sm mb-1">{t.title}</div>
                <div className="text-white/30 text-xs">{t.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { v: "12", l: "End-to-end services" },
              { v: "$0", l: "Upfront cost to clients" },
              { v: "100%", l: "Contingency-based" },
              { v: "Feb 2027", l: "CIT filing deadline" },
            ].map((s) => (
              <div key={s.l} className="text-center p-4 rounded-xl" style={{ background: "rgba(196, 160, 80, 0.05)", border: "1px solid rgba(196, 160, 80, 0.12)" }}>
                <div className="font-display text-2xl font-bold mb-1" style={{ color: "#f0d070" }}>{s.v}</div>
                <div className="text-[10px] text-white/35 uppercase tracking-wider">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-xl" style={{ background: "rgba(196, 160, 80, 0.06)", border: "1px solid rgba(196, 160, 80, 0.15)" }}>
            <div className="font-display text-lg font-semibold text-white mb-3">Upfront Funding Option for Your Clients</div>
            <p className="text-white/45 text-sm leading-relaxed">
              After a claim is accepted, clients can opt to sell it for 65&ndash;85 cents on the dollar through our financing partner. They receive funds in weeks instead of waiting months for CBP processing. Your commission is calculated on the buyout amount. Clients choose the timeline that works for them &mdash; and you earn either way.
            </p>
          </div>
        </div>
      </section>

      {/* The Math */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl sm:text-4xl mb-6" style={{ color: "#c4a050" }}>
            The Math Is Simple
          </h2>
          <p className="text-white/50 text-lg mb-12 max-w-2xl mx-auto">
            You have importers paying duties right now. Each one is a potential $10K&ndash;$500K+ recovery. You earn 25% of the legal fee on every successful claim.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { label: "Average Recovery", value: "$180K", sub: "Per qualified importer" },
              { label: "Firm Fee", value: "~25%", sub: "Of recovered amount" },
              { label: "Your Commission", value: "$11,250", sub: "Per referral (avg)" },
            ].map((item) => (
              <div key={item.label} className="p-6 rounded-2xl" style={{ background: "rgba(196, 160, 80, 0.06)", border: "1px solid rgba(196, 160, 80, 0.15)" }}>
                <div className="text-sm text-white/40 mb-2">{item.label}</div>
                <div className="font-display text-4xl font-bold mb-1" style={{ color: "#f0d070" }}>{item.value}</div>
                <div className="text-xs text-white/30">{item.sub}</div>
              </div>
            ))}
          </div>

          <div className="p-8 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(196,160,80,0.1) 0%, rgba(196,160,80,0.02) 100%)", border: "1px solid rgba(196,160,80,0.2)" }}>
            <div className="text-white/50 mb-2">Refer just 10 importers this quarter</div>
            <div className="font-display text-5xl font-bold" style={{ color: "#f0d070" }}>$112,500</div>
            <div className="text-white/30 text-sm mt-2">In commission income. Zero overhead. Zero legal work. Zero liability.</div>
          </div>
        </div>
      </section>

      {/* Why Arizona */}
      <section className="py-16" style={{ background: "#0c1220" }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="font-display text-2xl mb-4" style={{ color: "#c4a050" }}>Why Arizona?</h3>
          <p className="text-white/45 text-sm leading-relaxed max-w-2xl mx-auto">
            In August 2020, the Arizona Supreme Court unanimously eliminated Rule 5.4, making Arizona the first U.S. state to allow lawyers to pay referral fees to non-attorneys. This is why our commission model works &mdash; it&apos;s not a gray area. It&apos;s a fully authorized, bar-compliant fee structure. You earn documented commissions for every successful recovery you refer.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl sm:text-4xl mb-12 text-center" style={{ color: "#c4a050" }}>
            Questions? Answered.
          </h2>

          <div className="space-y-4">
            {[
              { q: "How long does the widget setup take?", a: "5 minutes. Generate an API key in your partner portal, add a Custom Panel in CargoWise or Magaya, paste the URL. That's it." },
              { q: "Do you access my clients' ACE accounts?", a: "Never. You share only the information you enter in the referral form. The legal team works from there." },
              { q: "How do I get paid?", a: "Direct deposit. After the client's recovery is complete and the legal fee is collected, your commission is processed in the next payout batch. Track everything in real time through your portal." },
              { q: "Is this legal?", a: "Yes. Our Arizona-licensed legal partner is authorized to pay referral fees to licensed customs brokers. The referral program is structured to comply with all applicable state bar rules." },
              { q: "What if my client doesn't qualify?", a: "No harm done. If a referral doesn't meet the criteria, we'll update the status in your widget dashboard. You're never charged for anything." },
              { q: "Can I use this with multiple TMS instances?", a: "Yes. Generate up to 10 API keys — one per TMS instance, office location, or team member." },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl overflow-hidden" style={{ background: "rgba(196, 160, 80, 0.04)", border: "1px solid rgba(196, 160, 80, 0.1)" }}>
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-white font-medium hover:text-white/80">
                  {item.q}
                  <span className="text-white/30 group-open:rotate-45 transition-transform text-xl ml-4">+</span>
                </summary>
                <div className="px-6 pb-4 text-white/45 text-sm leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(ellipse, #c4a050 0%, transparent 70%)" }} />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="font-display text-4xl sm:text-5xl mb-6" style={{ color: "#c4a050" }}>
            Stop Leaving Money on the Table
          </h2>
          <p className="text-xl text-white/50 mb-10 max-w-xl mx-auto">
            Your clients are paying duties that can be recovered. You already know which ones. Now you have a tool that lets you act on it in 30 seconds.
          </p>
          <Link href="/apply" className="inline-block text-lg font-bold px-12 py-5 rounded-full transition-transform hover:scale-105 active:scale-95" style={{ background: "linear-gradient(135deg, #c4a050 0%, #f0d070 100%)", color: "#060a14" }}>
            Apply Now — Free to Join
          </Link>
          <div className="text-white/20 text-xs mt-4">No fees. No obligations. Widget setup takes 5 minutes after approval.</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-white/20 text-xs">&copy; 2026 Fintella &mdash; Financial Intelligence Network. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-white/20 text-xs hover:text-white/40 transition">Privacy</Link>
            <Link href="/terms" className="text-white/20 text-xs hover:text-white/40 transition">Terms</Link>
            <Link href="/login" className="text-white/20 text-xs hover:text-white/40 transition">Partner Login</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
