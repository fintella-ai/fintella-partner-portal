import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RecoverForm from "@/components/landing/RecoverForm";
import { getRecoverContent } from "@/lib/getLandingContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { serviceSlug: string } }): Promise<Metadata> {
  if (params.serviceSlug === "tariff" || params.serviceSlug === "tariff-refund") {
    return {
      title: "Find Out How Much You're Owed — IEEPA Tariff Refund Recovery",
      description: "US importers have overpaid $166 billion in tariff duties. 83% haven't filed yet. Use our free calculator to estimate your refund.",
    };
  }
  const service = await prisma.service.findUnique({ where: { slug: params.serviceSlug } });
  if (!service) return {};
  return {
    title: `${service.name} — Fintella`,
    description: service.description || `Learn about our ${service.name} program.`,
  };
}

export default async function ServiceLandingPage({
  params,
  searchParams,
}: {
  params: { serviceSlug: string };
  searchParams: { ref?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };
}) {
  const slug = params.serviceSlug === "tariff" ? "tariff-refund" : params.serviceSlug;
  const service = await prisma.service.findUnique({ where: { slug } });
  if (!service || !service.active) return notFound();

  const partnerCode = searchParams.ref || searchParams.utm_content || null;
  const utmParams = {
    utm_source: searchParams.utm_source || null,
    utm_medium: searchParams.utm_medium || null,
    utm_campaign: searchParams.utm_campaign || null,
    utm_content: searchParams.utm_content || null,
    utm_term: null,
    utm_adgroup: null,
  };

  if (service.slug === "tariff-refund") {
    const c = await getRecoverContent();
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 leading-tight">
                {c.hero?.headline || "Find Out How Much You're Owed"}
              </h1>
              <p className="text-white/60 text-lg mb-6">
                {c.hero?.subheadline || "US importers have overpaid billions in tariff duties."}
              </p>
            </div>
            <div>
              <RecoverForm partnerCode={partnerCode} utmParams={utmParams} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const content = service.landingPageContent as any;
  const formFields = service.formFieldsConfig as Array<{ key: string; label: string; type: string; required?: boolean; options?: string[] }> | null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6" style={{ backgroundColor: `${service.accentColor || "#10b981"}20`, color: service.accentColor || "#10b981" }}>
              {service.shortName || service.name}
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 leading-tight">
              {content?.hero?.headline || service.name}
            </h1>
            <p className="text-white/60 text-lg mb-6">
              {content?.hero?.subheadline || service.description}
            </p>
            {content?.hero?.bullets && Array.isArray(content.hero.bullets) && (
              <ul className="space-y-2 text-white/50 text-sm">
                {content.hero.bullets.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span style={{ color: service.accentColor || "#10b981" }}>✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white/5 rounded-xl p-8 border border-white/10">
            <h2 className="text-xl font-semibold mb-6">Get Started with {service.name}</h2>
            <form action={`/api/webhook/referral`} method="POST" className="space-y-4">
              <input type="hidden" name="serviceSlug" value={service.slug} />
              {partnerCode && <input type="hidden" name="utm_content" value={partnerCode} />}

              <div className="grid grid-cols-2 gap-3">
                <input name="firstName" placeholder="First Name *" required className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
                <input name="lastName" placeholder="Last Name *" required className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
              </div>
              <input name="email" type="email" placeholder="Email *" required className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
              <input name="phone" type="tel" placeholder="Phone" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
              <input name="companyName" placeholder="Company / Legal Entity *" required className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />

              {formFields?.map((f) => (
                <div key={f.key}>
                  {f.type === "select" && f.options ? (
                    <select name={f.key} required={f.required} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                      <option value="">{f.label}{f.required ? " *" : ""}</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea name={f.key} placeholder={`${f.label}${f.required ? " *" : ""}`} required={f.required} rows={3} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
                  ) : (
                    <input name={f.key} placeholder={`${f.label}${f.required ? " *" : ""}`} required={f.required} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
                  )}
                </div>
              ))}

              <button type="submit" className="w-full py-3 rounded-lg font-semibold text-sm transition-colors" style={{ backgroundColor: service.accentColor || "#10b981", color: "#000" }}>
                Get Started
              </button>
              <p className="text-white/30 text-xs text-center">Our team will reach out within 24 hours.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
