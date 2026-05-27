"use client";

import { useRouter } from "next/navigation";
import { useDevice } from "@/lib/useDevice";

const SERVICES = [
  {
    slug: "tariff-refunds",
    name: "Tariff Refund",
    description: "Submit a client for IEEPA tariff refund recovery services.",
    color: "#d4a017",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    slug: "kwong",
    name: "Penalty Abatement (ERC)",
    description: "Submit a client for IRS Form 843 penalty abatement services.",
    color: "#14b8a6",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
];

export default function SubmitClientPage() {
  const router = useRouter();
  const device = useDevice();

  return (
    <div>
      <h2 className={`font-display ${device.isMobile ? "text-lg" : "text-[22px]"} font-bold mb-1.5`}>
        Submit a Client
      </h2>
      <p className="font-body text-[13px] text-[var(--app-text-muted)] mb-6">
        Choose a service to submit a client referral.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SERVICES.map((svc) => (
          <button
            key={svc.slug}
            type="button"
            onClick={() => router.push(`/dashboard/submit-client/${svc.slug}`)}
            className="card px-5 py-5 text-left hover:border-[var(--app-text-muted)]/30 transition-all group cursor-pointer"
            style={{ borderColor: "var(--app-border)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${svc.color}15`, color: svc.color }}
              >
                {svc.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[15px] font-bold mb-1 group-hover:text-[var(--app-text)] transition-colors">
                  {svc.name}
                </div>
                <p className="font-body text-[12px] text-[var(--app-text-muted)] leading-relaxed">
                  {svc.description}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-[var(--app-text-faint)] group-hover:text-[var(--app-text-muted)] transition-colors flex-shrink-0 mt-1"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
