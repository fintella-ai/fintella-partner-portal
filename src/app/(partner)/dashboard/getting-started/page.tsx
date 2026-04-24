"use client";

import { useEffect, useState } from "react";
import type { GettingStartedResult } from "@/lib/getting-started";
import { GettingStartedChecklist } from "@/components/partner/GettingStartedChecklist";
import { PartnerExpectations } from "@/components/partner/PartnerExpectations";
import { FIRM_SHORT } from "@/lib/constants";

export default function GettingStartedPage() {
  const [firstName, setFirstName] = useState<string>("");
  const [data, setData] = useState<GettingStartedResult | null>(null);

  useEffect(() => {
    fetch("/api/partner/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.partner?.firstName) setFirstName(d.partner.firstName);
      })
      .catch(() => {});
    fetch("/api/partner/getting-started", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GettingStartedResult | null) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  const completed = data && data.completedCount === data.totalCount && data.totalCount > 0;

  return (
    <div className="max-w-4xl mx-auto text-left">
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--app-text)]">
          {completed
            ? `You're all set, ${firstName || "partner"} 🎉`
            : firstName
              ? `Welcome, ${firstName} — here's how to get the most out of ${FIRM_SHORT}`
              : `Get the most out of ${FIRM_SHORT}`}
        </h1>
        <p className="font-body text-[14px] text-[var(--app-text-secondary)] mt-2 leading-relaxed">
          {completed
            ? "You've completed every getting-started step. Keep momentum with your Live Weekly calls and watch for new offers in your inbox."
            : "Work through this checklist in your first week. Every step is a direct path to earning your first commission."}
        </p>
      </div>

      <div className="mb-8">
        <GettingStartedChecklist variant="page" />
      </div>

      <div className="mb-8">
        <PartnerExpectations markdown={data?.expectationsMarkdown} />
      </div>

      <div className="mb-12">
        <div className="card p-6 sm:p-8 text-center border-brand-gold/30 bg-brand-gold/[0.04]">
          <h2 className="font-display text-lg sm:text-xl font-semibold text-brand-gold mb-2">
            Join this week's Live Weekly call
          </h2>
          <p className="font-body text-[13px] sm:text-[14px] text-[var(--app-text-secondary)] mb-5 max-w-xl mx-auto leading-relaxed">
            The single fastest way to learn the product, meet other partners, and find out what's working right now. Every {FIRM_SHORT} partner should be on at least one a month.
          </p>
          <a
            href="/dashboard/conference"
            className="inline-block bg-brand-gold text-black font-semibold font-body text-[12px] tracking-[1px] uppercase rounded-lg px-6 py-3 hover:bg-brand-gold/90 transition-colors"
          >
            See the next call
          </a>
        </div>
      </div>
    </div>
  );
}
