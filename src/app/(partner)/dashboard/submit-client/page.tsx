"use client";

import { useSession } from "next-auth/react";
import { useDevice } from "@/lib/useDevice";
import { FIRM_SHORT } from "@/lib/constants";

const BASE_REFERRAL_URL = "https://frostlawaz.com/referral";
const DEFAULT_PARAMS = {
  RR_WCID: "5D5FFDC6-E177-4FF9-99BD-7CFECDB92D54",
  RR_WCID_TTL: "396",
  utm_campaign: "Tariff+Refunds",
};

export default function SubmitClientPage() {
  const { data: session } = useSession();
  const device = useDevice();
  const user = session?.user as any;
  const partnerCode = user?.partnerCode || "DEMO";
  const partnerName = user?.name || "Partner";

  // Build the referral URL with the partner's code
  const params = new URLSearchParams({
    ...DEFAULT_PARAMS,
    REFERRALCODE: partnerCode,
  });
  const referralUrl = `${BASE_REFERRAL_URL}?${params.toString()}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
  };

  return (
    <div>
      <h2 className={`font-display ${device.isMobile ? "text-lg" : "text-[22px]"} font-bold mb-1.5`}>
        Submit a Client
      </h2>
      <p className="font-body text-[13px] text-white/40 mb-4">
        Use the form below to submit a client referral. This submission is tracked to your partner account.
      </p>

      {/* Partner info bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center">
            <span className="font-body text-[11px] font-bold text-brand-gold">
              {partnerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div>
            <div className="font-body text-[13px] text-white/80 font-medium">{partnerName}</div>
            <div className="font-mono text-[11px] text-white/40">{partnerCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="font-body text-[11px] text-brand-gold/70 border border-brand-gold/20 rounded-lg px-3 py-1.5 hover:bg-brand-gold/10 transition-colors"
          >
            Copy Referral Link
          </button>
        </div>
      </div>

      {/* Embedded referral form */}
      <div className={`card overflow-hidden ${device.borderRadius}`}>
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="font-body text-[12px] text-white/40">
            Client Submission Form — tracked to <span className="text-brand-gold font-semibold">{partnerCode}</span>
          </div>
          <a
            href={referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-[11px] text-white/30 hover:text-white/50 transition-colors"
          >
            Open in new tab ↗
          </a>
        </div>
        <div className="bg-white" style={{ height: device.isMobile ? "calc(100vh - 220px)" : "75vh" }}>
          <iframe
            src={referralUrl}
            className="w-full h-full border-0"
            title="Client Referral Submission"
            allow="camera; microphone; geolocation"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation"
          />
        </div>
      </div>

      {/* Info footer */}
      <div className="mt-4 font-body text-[11px] text-white/25 text-center leading-relaxed">
        All submissions through this form are automatically tracked to your partner account ({partnerCode}).
        <br />
        Your downline partners have their own unique links. Contact {FIRM_SHORT} support with any questions.
      </div>
    </div>
  );
}
