# Multi-Service Partner Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Service` registry so the partner portal supports multiple service types (tariff refunds, R&D tax credits, future services) with per-service forms, training, commissions, landing pages, and a unified rollup view.

**Architecture:** A new `Service` model is the source of truth. Existing tables (`Deal`, `TrainingModule`, `CommissionLedger`) get a `serviceId` FK. The partner UI gains a service switcher that filters all data. Each service has its own public landing page and webhook fulfillment routing.

**Tech Stack:** Next.js 14 App Router, Prisma (Neon Postgres), React, Tailwind CSS, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-21-multi-service-partner-portal-design.md`

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `prisma/migrations/YYYYMMDD_add_services/migration.sql` | Service table, PartnerServiceRate, serviceId FKs, backfill |
| Modify | `prisma/schema.prisma` | Add Service, PartnerServiceRate models; add serviceId to Deal, TrainingModule, CommissionLedger |
| Create | `scripts/seed-services.js` | Seed tariff-refund + rd-credits services |
| Create | `src/lib/services.ts` | `getServices()`, `getServiceBySlug()`, `getCommissionRate()` helpers |
| Create | `src/contexts/ServiceContext.tsx` | React context: activeServiceId, setActiveService, services list |
| Create | `src/components/ui/ServiceSwitcher.tsx` | Dropdown in sidebar for switching active service |
| Modify | `src/app/(partner)/dashboard/layout.tsx` | Wrap in ServiceProvider, render ServiceSwitcher above nav |
| Create | `src/app/api/services/route.ts` | GET: list active services |
| Modify | `src/app/api/webhook/referral/route.ts` | Accept serviceSlug, resolve Service, route fulfillment |
| Create | `src/lib/fulfillment.ts` | `routeToFulfillment(deal, service)` — POST to webhookUrl for internal services |
| Create | `src/app/api/webhook/service-update/route.ts` | Inbound webhook from R&D app to update deal stage |
| Modify | `src/app/(partner)/dashboard/submit-client/page.tsx` | Service-aware: load form config from active service |
| Modify | `src/app/(partner)/dashboard/deals/page.tsx` | Filter by serviceId, add service badge column |
| Modify | `src/app/(partner)/dashboard/downline/page.tsx` | Filter by serviceId |
| Modify | `src/app/(partner)/dashboard/reporting/page.tsx` | Filter by serviceId; "All Services" rollup with badge |
| Modify | `src/app/(partner)/dashboard/commissions/page.tsx` | Filter by serviceId |
| Modify | `src/app/(partner)/dashboard/training/page.tsx` | Filter by serviceId |
| Modify | `src/app/(partner)/dashboard/referral-links/page.tsx` | Show per-service referral URLs |
| Create | `src/app/recover/[serviceSlug]/page.tsx` | Dynamic landing page per service |
| Modify | `src/app/recover/page.tsx` | Redirect to `/recover/tariff` (backward compat) |
| Modify | `src/app/(admin)/admin/deals/page.tsx` | Service filter + badge column |
| Create | `src/app/(admin)/admin/services/page.tsx` | Admin CRUD for services |
| Create | `src/app/api/admin/services/route.ts` | GET/POST/PATCH for service management |

---

### Task 1: Prisma Schema — Service Model + FKs

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Service model to schema**

Add after the last model in `prisma/schema.prisma`:

```prisma
// ─── SERVICE REGISTRY ────────────────────────────────────────────────────────
model Service {
  id                    String   @id @default(cuid())
  slug                  String   @unique
  name                  String
  shortName             String?
  description           String?
  active                Boolean  @default(true)
  defaultCommissionRate Float    @default(0.25)
  l2RateMultiplier      Float    @default(0.50)
  l3RateMultiplier      Float    @default(0.50)
  firmFeeRate           Float?
  formFieldsConfig      Json?
  fulfillmentType       String   @default("external")
  webhookUrl            String?
  webhookHeaders        Json?
  landingPageSlug       String?
  landingPageContent    Json?
  stages                Json?
  accentColor           String?
  iconEmoji             String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  deals                 Deal[]
  trainingModules       TrainingModule[]
  partnerRates          PartnerServiceRate[]
  commissionEntries     CommissionLedger[]
}

model PartnerServiceRate {
  id             String   @id @default(cuid())
  partnerCode    String
  serviceId      String
  commissionRate Float
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  partner        Partner  @relation(fields: [partnerCode], references: [partnerCode])
  service        Service  @relation(fields: [serviceId], references: [id])

  @@unique([partnerCode, serviceId])
}
```

- [ ] **Step 2: Add serviceId FK to Deal model**

In the `Deal` model, add before the `@@index` lines:

```prisma
  serviceId             String?
  service               Service?  @relation(fields: [serviceId], references: [id])
  serviceFields         Json?     // service-specific form fields (R&D spend, industry, etc.)
```

Add an index: `@@index([serviceId])`

- [ ] **Step 3: Add serviceId FK to TrainingModule model**

In the `TrainingModule` model, add:

```prisma
  serviceId     String?
  service       Service?  @relation(fields: [serviceId], references: [id])
```

- [ ] **Step 4: Add serviceId FK to CommissionLedger model**

In the `CommissionLedger` model, add:

```prisma
  serviceId     String?
  service       Service?  @relation(fields: [serviceId], references: [id])
```

- [ ] **Step 5: Add relation array to Partner model**

In the `Partner` model, add:

```prisma
  serviceRates  PartnerServiceRate[]
```

- [ ] **Step 6: Run prisma generate to verify schema**

Run: `cd ~/tariff-partner-portal && npx prisma generate`
Expected: `✔ Generated Prisma Client` — no errors.

- [ ] **Step 7: Create migration**

Run: `cd ~/tariff-partner-portal && npx prisma migrate dev --name add_services --create-only`
Expected: Creates a migration SQL file in `prisma/migrations/`.

- [ ] **Step 8: Add backfill SQL to migration**

Append to the generated migration SQL file, after the CREATE TABLE statements:

```sql
-- Seed tariff-refund service
INSERT INTO "Service" (id, slug, name, "shortName", description, active, "defaultCommissionRate", "l2RateMultiplier", "l3RateMultiplier", "firmFeeRate", "fulfillmentType", "accentColor", "iconEmoji", "createdAt", "updatedAt")
VALUES (
  'svc_tariff_refund',
  'tariff-refund',
  'Tariff Refund',
  'Tariff',
  'IEEPA tariff refund recovery — fulfilled by Frost Law',
  true,
  0.25,
  0.50,
  0.50,
  0.20,
  'external',
  '#3b82f6',
  'shield',
  NOW(),
  NOW()
);

-- Seed rd-credits service
INSERT INTO "Service" (id, slug, name, "shortName", description, active, "defaultCommissionRate", "l2RateMultiplier", "l3RateMultiplier", "firmFeeRate", "fulfillmentType", "formFieldsConfig", "accentColor", "iconEmoji", "landingPageSlug", "createdAt", "updatedAt")
VALUES (
  'svc_rd_credits',
  'rd-credits',
  'R&D Tax Credits',
  'R&D',
  'R&D tax credit recovery — fulfilled internally by Fintella',
  true,
  0.15,
  0.50,
  0.50,
  0.25,
  'internal',
  '[{"key":"annualRdSpend","label":"Annual R&D Spend","type":"select","required":true,"options":["Under $100K","$100K - $500K","$500K - $1M","$1M - $5M","$5M+"]},{"key":"employeeCount","label":"Number of Employees","type":"select","required":true,"options":["1-10","11-50","51-200","201-500","500+"]},{"key":"industry","label":"Industry","type":"select","required":true,"options":["Software/Tech","Manufacturing","Biotech/Pharma","Engineering","Food Science","Agriculture","Other"]},{"key":"rdActivities","label":"Describe Your R&D Activities","type":"textarea","required":true},{"key":"previouslyClaimed","label":"Previously Claimed R&D Credits?","type":"select","required":false,"options":["Yes","No","Not Sure"]}]',
  '#10b981',
  'flask',
  '/recover/rd-credits',
  NOW(),
  NOW()
);

-- Backfill existing deals
UPDATE "Deal" SET "serviceId" = 'svc_tariff_refund' WHERE "serviceId" IS NULL;

-- Backfill existing training modules
UPDATE "TrainingModule" SET "serviceId" = 'svc_tariff_refund' WHERE "serviceId" IS NULL;

-- Backfill existing commission ledger
UPDATE "CommissionLedger" SET "serviceId" = 'svc_tariff_refund' WHERE "serviceId" IS NULL;
```

- [ ] **Step 9: Apply migration**

Run: `cd ~/tariff-partner-portal && npx prisma migrate dev`
Expected: Migration applies successfully, all backfills run.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Service model, PartnerServiceRate, serviceId FKs + backfill"
```

---

### Task 2: Service Helpers Library

**Files:**
- Create: `src/lib/services.ts`

- [ ] **Step 1: Create service helper functions**

```typescript
import { prisma } from "@/lib/prisma";

export type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  active: boolean;
  defaultCommissionRate: number;
  l2RateMultiplier: number;
  l3RateMultiplier: number;
  firmFeeRate: number | null;
  formFieldsConfig: any;
  fulfillmentType: string;
  webhookUrl: string | null;
  webhookHeaders: any;
  landingPageSlug: string | null;
  landingPageContent: any;
  stages: any;
  accentColor: string | null;
  iconEmoji: string | null;
};

export async function getActiveServices(): Promise<ServiceRow[]> {
  return prisma.service.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getServiceBySlug(slug: string): Promise<ServiceRow | null> {
  return prisma.service.findUnique({ where: { slug } });
}

export async function getServiceById(id: string): Promise<ServiceRow | null> {
  return prisma.service.findUnique({ where: { id } });
}

export async function getCommissionRateForPartner(
  partnerCode: string,
  serviceId: string
): Promise<number> {
  const override = await prisma.partnerServiceRate.findUnique({
    where: { partnerCode_serviceId: { partnerCode, serviceId } },
  });
  if (override) return override.commissionRate;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { defaultCommissionRate: true },
  });
  return service?.defaultCommissionRate ?? 0.25;
}

export function getStageLabels(service: ServiceRow | null): Record<string, { label: string; color: string }> {
  if (service?.stages && Array.isArray(service.stages)) {
    const map: Record<string, { label: string; color: string }> = {};
    for (const s of service.stages as Array<{ key: string; label: string; color: string }>) {
      map[s.key] = { label: s.label, color: s.color };
    }
    return map;
  }
  // Fall back to global constants
  const { STAGE_LABELS } = require("@/lib/constants");
  return STAGE_LABELS;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services.ts
git commit -m "feat: add service helper library — getActiveServices, getCommissionRate, getStageLabels"
```

---

### Task 3: Fulfillment Router

**Files:**
- Create: `src/lib/fulfillment.ts`

- [ ] **Step 1: Create fulfillment routing function**

```typescript
import type { ServiceRow } from "@/lib/services";

interface FulfillmentPayload {
  event: "deal.created" | "deal.updated";
  deal: Record<string, any>;
  partner: { partnerCode: string; firstName: string; lastName: string; email: string };
  service: { slug: string; name: string };
}

export async function routeToFulfillment(
  service: ServiceRow,
  payload: FulfillmentPayload
): Promise<{ ok: boolean; status?: number; body?: string }> {
  if (service.fulfillmentType !== "internal" || !service.webhookUrl) {
    return { ok: true };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(service.webhookHeaders && typeof service.webhookHeaders === "object"
      ? (service.webhookHeaders as Record<string, string>)
      : {}),
  };

  try {
    const res = await fetch(service.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      console.error(
        `[fulfillment] POST ${service.webhookUrl} returned ${res.status}: ${body.slice(0, 500)}`
      );
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err: any) {
    console.error(`[fulfillment] POST ${service.webhookUrl} failed:`, err.message);
    return { ok: false, body: err.message };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fulfillment.ts
git commit -m "feat: add fulfillment router — webhook POST for internal services"
```

---

### Task 4: Services API Route

**Files:**
- Create: `src/app/api/services/route.ts`

- [ ] **Step 1: Create GET endpoint for active services**

```typescript
import { NextResponse } from "next/server";
import { getActiveServices } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const services = await getActiveServices();
    return NextResponse.json({ services });
  } catch (err: any) {
    console.error("[api/services] error:", err.message);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/services/route.ts
git commit -m "feat: add GET /api/services — list active services"
```

---

### Task 5: ServiceContext + ServiceSwitcher Component

**Files:**
- Create: `src/contexts/ServiceContext.tsx`
- Create: `src/components/ui/ServiceSwitcher.tsx`

- [ ] **Step 1: Create ServiceContext**

```typescript
"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface ServiceInfo {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  accentColor: string | null;
  iconEmoji: string | null;
}

interface ServiceContextValue {
  services: ServiceInfo[];
  activeServiceId: string | null; // null = "All Services"
  activeService: ServiceInfo | null;
  setActiveServiceId: (id: string | null) => void;
  loading: boolean;
}

const ServiceCtx = createContext<ServiceContextValue>({
  services: [],
  activeServiceId: null,
  activeService: null,
  setActiveServiceId: () => {},
  loading: true,
});

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [activeServiceId, setActiveServiceIdRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        const list: ServiceInfo[] = (data.services || []).map((s: any) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          shortName: s.shortName,
          accentColor: s.accentColor,
          iconEmoji: s.iconEmoji,
        }));
        setServices(list);
        const stored = typeof window !== "undefined" ? localStorage.getItem("activeServiceId") : null;
        if (stored && list.some((s) => s.id === stored)) {
          setActiveServiceIdRaw(stored);
        } else if (list.length > 0) {
          setActiveServiceIdRaw(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setActiveServiceId = useCallback((id: string | null) => {
    setActiveServiceIdRaw(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("activeServiceId", id);
      else localStorage.removeItem("activeServiceId");
    }
  }, []);

  const activeService = activeServiceId
    ? services.find((s) => s.id === activeServiceId) ?? null
    : null;

  return (
    <ServiceCtx.Provider value={{ services, activeServiceId, activeService, setActiveServiceId, loading }}>
      {children}
    </ServiceCtx.Provider>
  );
}

export function useService() {
  return useContext(ServiceCtx);
}
```

- [ ] **Step 2: Create ServiceSwitcher component**

```tsx
"use client";

import { useService } from "@/contexts/ServiceContext";
import { useState, useRef, useEffect } from "react";

export default function ServiceSwitcher() {
  const { services, activeServiceId, activeService, setActiveServiceId } = useService();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (services.length < 2) return null;

  const label = activeService ? (activeService.shortName || activeService.name) : "All Services";

  return (
    <div ref={ref} className="relative mb-3 px-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
      >
        {activeService?.accentColor && (
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: activeService.accentColor }}
          />
        )}
        <span className="truncate">{label}</span>
        <span className="ml-auto text-white/40">▾</span>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveServiceId(s.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                activeServiceId === s.id ? "bg-white/5 font-medium" : ""
              }`}
            >
              {s.accentColor && (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.accentColor }} />
              )}
              <span>{s.shortName || s.name}</span>
            </button>
          ))}
          <div className="border-t border-white/10" />
          <button
            onClick={() => { setActiveServiceId(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
              activeServiceId === null ? "bg-white/5 font-medium" : ""
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" />
            <span>All Services</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/contexts/ServiceContext.tsx src/components/ui/ServiceSwitcher.tsx
git commit -m "feat: add ServiceContext + ServiceSwitcher dropdown component"
```

---

### Task 6: Wire ServiceProvider + Switcher into Partner Layout

**Files:**
- Modify: `src/app/(partner)/dashboard/layout.tsx`

- [ ] **Step 1: Add ServiceProvider import at the top**

Add to the imports at the top of the file:

```typescript
import { ServiceProvider } from "@/contexts/ServiceContext";
import ServiceSwitcher from "@/components/ui/ServiceSwitcher";
```

- [ ] **Step 2: Wrap the layout return in ServiceProvider**

Find the outermost `<div>` returned by the layout component and wrap it:

```tsx
return (
  <ServiceProvider>
    {/* existing layout JSX */}
  </ServiceProvider>
);
```

- [ ] **Step 3: Add ServiceSwitcher to the sidebar**

Find where the sidebar nav items are rendered (the `MAIN_NAV.map(...)` section). Add `<ServiceSwitcher />` just above the nav list, inside the sidebar panel:

```tsx
{/* Service switcher — above nav items */}
<ServiceSwitcher />
```

- [ ] **Step 4: Verify the build passes**

Run: `cd ~/tariff-partner-portal && npx next build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(partner\)/dashboard/layout.tsx
git commit -m "feat: wire ServiceProvider + ServiceSwitcher into partner dashboard layout"
```

---

### Task 7: Extend Webhook/Referral POST with Service Resolution

**Files:**
- Modify: `src/app/api/webhook/referral/route.ts`
- Modify: `src/lib/fulfillment.ts` (already created)

- [ ] **Step 1: Add service resolution to postHandler**

Near the top of `postHandler` (after body is parsed, around line 400), add service lookup:

```typescript
import { getServiceBySlug, getCommissionRateForPartner } from "@/lib/services";
import { routeToFulfillment } from "@/lib/fulfillment";
```

After the idempotency check, before the partner lookup, add:

```typescript
    // ── Service resolution ──────────────────────────────────────────────
    const serviceSlug = typeof body.serviceSlug === "string" ? body.serviceSlug.trim()
      : typeof body.service_slug === "string" ? body.service_slug.trim()
      : null;
    const service = serviceSlug
      ? await getServiceBySlug(serviceSlug)
      : await getServiceBySlug("tariff-refund"); // default for backward compat

    const serviceId = service?.id || null;
```

- [ ] **Step 2: Pass serviceId into the Deal.create call**

In the `prisma.deal.create({ data: { ... } })` call inside postHandler, add:

```typescript
      serviceId,
      serviceFields: service?.formFieldsConfig ? extractServiceFields(body, service.formFieldsConfig) : null,
```

Add this helper at the top of the file:

```typescript
function extractServiceFields(body: Record<string, any>, config: any): Record<string, any> | null {
  if (!Array.isArray(config)) return null;
  const fields: Record<string, any> = {};
  for (const f of config) {
    const val = body[f.key] ?? body[f.key.replace(/([A-Z])/g, "_$1").toLowerCase()] ?? null;
    if (val !== null && val !== undefined) fields[f.key] = val;
  }
  return Object.keys(fields).length > 0 ? fields : null;
}
```

- [ ] **Step 3: Use service commission rate instead of hardcoded**

Where `l1CommissionRate` is calculated (the `getL1CommissionRateSnapshot` call), replace or augment it to check per-service rates:

```typescript
    // Service-aware commission rate
    const l1Rate = service
      ? await getCommissionRateForPartner(partnerCode, service.id)
      : partner?.commissionRate ?? 0.25;
```

- [ ] **Step 4: Add serviceId to CommissionLedger creation**

Wherever `prisma.commissionLedger.create` is called, add `serviceId` to the data object:

```typescript
    serviceId,
```

- [ ] **Step 5: Fire internal fulfillment webhook after deal creation**

After the deal is created (after the `prisma.deal.create` call), add:

```typescript
    // Route to fulfillment (internal services)
    if (service) {
      routeToFulfillment(service as any, {
        event: "deal.created",
        deal: { id: deal.id, dealName: deal.dealName, stage: deal.stage, clientEmail: deal.clientEmail, ...deal },
        partner: { partnerCode, firstName: partner?.firstName || "", lastName: partner?.lastName || "", email: partner?.email || "" },
        service: { slug: service.slug, name: service.name },
      }).catch((err) => console.error("[webhook/referral] fulfillment error:", err));
    }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhook/referral/route.ts
git commit -m "feat: webhook/referral — resolve service, route fulfillment, per-service commissions"
```

---

### Task 8: Inbound Service Update Webhook

**Files:**
- Create: `src/app/api/webhook/service-update/route.ts`

- [ ] **Step 1: Create the inbound webhook endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.SERVICE_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || req.headers.get("x-webhook-secret") || "";
    if (auth !== `Bearer ${secret}` && auth !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dealId = body.dealId || body.deal_id;
  if (!dealId) {
    return NextResponse.json({ error: "dealId required" }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const data: Record<string, any> = {};
  if (body.stage) data.stage = body.stage;
  if (body.externalStage) data.externalStage = body.externalStage;
  if (body.externalDealId) data.externalDealId = body.externalDealId;
  if (body.notes) data.notes = body.notes;
  if (body.estimatedRefundAmount !== undefined) data.estimatedRefundAmount = Number(body.estimatedRefundAmount);
  if (body.actualRefundAmount !== undefined) data.actualRefundAmount = Number(body.actualRefundAmount);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = await prisma.deal.update({ where: { id: dealId }, data });

  return NextResponse.json({ ok: true, dealId: updated.id, stage: updated.stage });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhook/service-update/route.ts
git commit -m "feat: add POST /api/webhook/service-update — inbound stage updates from fulfillment apps"
```

---

### Task 9: Partner API Routes — Add serviceId Filtering

**Files:**
- Modify: `src/app/api/deals/route.ts`

- [ ] **Step 1: Add serviceId query param to deals API**

In the GET handler of `src/app/api/deals/route.ts`, read the `serviceId` query param and add it to the Prisma where clause:

```typescript
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  // ... existing where clause ...
  const where: any = { partnerCode };
  if (serviceId) where.serviceId = serviceId;
```

Apply the same pattern to the downline deals query in the same file (if it queries deals for downline partners).

- [ ] **Step 2: Add serviceId to commission queries**

In `src/app/api/commissions/route.ts` (or wherever commissions are fetched), add the same `serviceId` filter:

```typescript
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  const where: any = { partnerCode };
  if (serviceId) where.serviceId = serviceId;
```

- [ ] **Step 3: Add serviceId to training modules query**

In the training API route (or the training page's fetch call), filter by serviceId:

```typescript
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  const where: any = { published: true };
  if (serviceId) where.serviceId = serviceId;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/deals/route.ts src/app/api/commissions/route.ts
git commit -m "feat: add serviceId filtering to deals + commissions API routes"
```

---

### Task 10: Partner Pages — Service-Aware Filtering

**Files:**
- Modify: `src/app/(partner)/dashboard/deals/page.tsx`
- Modify: `src/app/(partner)/dashboard/downline/page.tsx`
- Modify: `src/app/(partner)/dashboard/reporting/page.tsx`
- Modify: `src/app/(partner)/dashboard/commissions/page.tsx` (if exists)
- Modify: `src/app/(partner)/dashboard/training/page.tsx`
- Modify: `src/app/(partner)/dashboard/referral-links/page.tsx`

- [ ] **Step 1: Add useService() hook to all partner pages**

In each page above, add at the top of the component:

```typescript
import { useService } from "@/contexts/ServiceContext";
// ... inside component:
const { activeServiceId, activeService } = useService();
```

- [ ] **Step 2: Append serviceId to all fetch calls**

Every `fetch("/api/deals")` becomes:

```typescript
fetch(`/api/deals${activeServiceId ? `?serviceId=${activeServiceId}` : ""}`)
```

Same for `/api/commissions`, `/api/training/modules`, etc. Add `activeServiceId` to the dependency array of the `useEffect` or `useCallback` that triggers the fetch.

- [ ] **Step 3: Add service badge to deal rows**

In the deals table, add a column showing the service badge:

```tsx
{deal.service && (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
    style={{ backgroundColor: `${deal.service.accentColor}20`, color: deal.service.accentColor }}
  >
    {deal.service.shortName || deal.service.name}
  </span>
)}
```

For this to work, the deals API response needs to include the service relation. Add `include: { service: { select: { shortName: true, name: true, accentColor: true } } }` to the Prisma query.

- [ ] **Step 4: Update referral-links page**

In `src/app/(partner)/dashboard/referral-links/page.tsx`, fetch services and show per-service referral URLs:

```tsx
const { services } = useService();
// Render a card per service:
{services.map((s) => (
  <div key={s.id} className="p-4 bg-white/5 rounded-lg">
    <div className="flex items-center gap-2 mb-2">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.accentColor || "#666" }} />
      <span className="font-medium text-sm">{s.name}</span>
    </div>
    <CopyableLink url={`https://fintella.partners/recover/${s.slug}?ref=${partnerCode}`} />
  </div>
))}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(partner\)/dashboard/
git commit -m "feat: service-aware filtering on all partner dashboard pages + service badges"
```

---

### Task 11: Dynamic Service Landing Page

**Files:**
- Create: `src/app/recover/[serviceSlug]/page.tsx`
- Modify: `src/app/recover/page.tsx`

- [ ] **Step 1: Create dynamic landing page**

```tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RecoverForm from "@/components/landing/RecoverForm";
import { getRecoverContent } from "@/lib/getLandingContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { serviceSlug: string } }): Promise<Metadata> {
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
  const service = await prisma.service.findUnique({ where: { slug: params.serviceSlug } });
  if (!service || !service.active) return notFound();

  // For tariff, fall through to existing recover page content
  if (service.slug === "tariff-refund") {
    const c = await getRecoverContent();
    const partnerCode = searchParams.ref || searchParams.utm_content || null;
    const utmParams = {
      utm_source: searchParams.utm_source || null,
      utm_medium: searchParams.utm_medium || null,
      utm_campaign: searchParams.utm_campaign || null,
      utm_content: searchParams.utm_content || null,
      utm_term: null,
      utm_adgroup: null,
    };
    // Render existing tariff recover page content
    // (import and reuse the existing section components from recover/page.tsx)
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Reuse existing tariff landing page layout */}
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <h1 className="font-display text-4xl font-bold mb-4">{c.hero?.headline || service.name}</h1>
          <p className="text-white/60 mb-8">{c.hero?.subheadline || service.description}</p>
          <RecoverForm partnerCode={partnerCode} utmParams={utmParams} />
        </div>
      </div>
    );
  }

  // Generic service landing page from service.landingPageContent
  const content = service.landingPageContent as any;
  const partnerCode = searchParams.ref || searchParams.utm_content || null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <h1 className="font-display text-4xl font-bold mb-4">
          {content?.hero?.headline || service.name}
        </h1>
        <p className="text-white/60 text-lg mb-8">
          {content?.hero?.subheadline || service.description}
        </p>

        {/* Dynamic form from formFieldsConfig */}
        <ServiceSubmissionForm
          service={service}
          partnerCode={partnerCode}
        />
      </div>
    </div>
  );
}

function ServiceSubmissionForm({ service, partnerCode }: { service: any; partnerCode: string | null }) {
  // This is a server component shell — the actual form is a client component
  // For now, render a simple form that POSTs to /api/webhook/referral
  return (
    <div className="bg-white/5 rounded-xl p-8 border border-white/10">
      <h2 className="text-xl font-semibold mb-6">Get Started with {service.name}</h2>
      <p className="text-white/40 text-sm mb-4">
        Fill out the form below and our team will reach out within 24 hours.
      </p>
      {/* Client-side form component will be created in a follow-up task */}
      <p className="text-white/30 text-xs italic">Form coming soon — submit via partner portal in the meantime.</p>
    </div>
  );
}
```

- [ ] **Step 2: Redirect /recover to /recover/tariff**

Modify `src/app/recover/page.tsx` — add a redirect at the top:

```typescript
import { redirect } from "next/navigation";

// Redirect legacy /recover to /recover/tariff
// Keep this file so existing links don't 404
export default function RecoverRedirect() {
  redirect("/recover/tariff");
}
```

Note: preserve the existing recover page content — move the HeroSection and other components to be importable from the `[serviceSlug]` page. For the initial implementation, the redirect is sufficient; the tariff-refund service slug page will reuse the existing content.

- [ ] **Step 3: Commit**

```bash
git add src/app/recover/
git commit -m "feat: dynamic service landing pages at /recover/[serviceSlug] + redirect /recover → /recover/tariff"
```

---

### Task 12: Admin Service Management Page

**Files:**
- Create: `src/app/(admin)/admin/services/page.tsx`
- Create: `src/app/api/admin/services/route.ts`

- [ ] **Step 1: Create admin services API**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!(session?.user as any)?.role?.includes("admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ services });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const service = await prisma.service.create({ data: body });
  return NextResponse.json({ service }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as any)?.role?.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const service = await prisma.service.update({ where: { id }, data });
  return NextResponse.json({ service });
}
```

- [ ] **Step 2: Create admin services page**

Create `src/app/(admin)/admin/services/page.tsx` with a table listing all services, their slug, status (active/inactive toggle), commission rate, and fulfillment type. Include an "Add Service" button that opens a modal with the Service fields. This follows the same admin page patterns as `src/app/(admin)/admin/settings/page.tsx`.

The page should display:
- Table columns: Name, Slug, Commission Rate, Fulfillment, Status, Actions
- Edit button per row → opens modal with all Service fields
- Active/Inactive toggle
- Form field config editor (JSON textarea for now; visual editor is future phase)

- [ ] **Step 3: Add Services to admin nav**

In `src/app/(admin)/admin/layout.tsx`, add a nav item for Services:

```typescript
{ href: "/admin/services", icon: "⚙️", label: "Services" },
```

- [ ] **Step 4: Add service filter to admin deals page**

In `src/app/(admin)/admin/deals/page.tsx`, add a service filter dropdown at the top of the page and a service badge column in the deals table. Fetch services from `/api/admin/services` and filter the deals query by `serviceId`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/services/ src/app/api/admin/services/ src/app/\(admin\)/admin/layout.tsx src/app/\(admin\)/admin/deals/page.tsx
git commit -m "feat: admin services CRUD page + service filter on admin deals"
```

---

### Task 13: Submit Client Page — Service-Aware Form

**Files:**
- Modify: `src/app/(partner)/dashboard/submit-client/page.tsx`

- [ ] **Step 1: Replace hardcoded Frost Law iframe with service-aware form**

The current submit-client page embeds a Frost Law referral URL in an iframe. Replace it with a service-aware flow:

- When `activeService.fulfillmentType === "external"` and the service is `tariff-refund`, keep the existing iframe behavior (Frost Law URL)
- For all other services, render a native form built from `service.formFieldsConfig` + shared base fields that POSTs to `/api/webhook/referral` with `serviceSlug`

```tsx
import { useService } from "@/contexts/ServiceContext";

// Inside component:
const { activeService, services } = useService();

// If no active service or tariff, show existing iframe
if (!activeService || activeService.slug === "tariff-refund") {
  return (/* existing iframe code */);
}

// For other services, render dynamic form
return (
  <ServiceSubmitForm service={activeService} partnerCode={partnerCode} />
);
```

Create a `ServiceSubmitForm` client component that:
1. Renders shared fields: first name, last name, email, phone, legal entity, EIN, address
2. Renders service-specific fields from `formFieldsConfig` (fetched from `/api/services`)
3. POSTs to `/api/webhook/referral` with `serviceSlug` in the body
4. Shows success/error states

- [ ] **Step 2: Commit**

```bash
git add src/app/\(partner\)/dashboard/submit-client/page.tsx
git commit -m "feat: service-aware submit client page — dynamic form for non-tariff services"
```

---

### Task 14: Build Verification + Seed Test

- [ ] **Step 1: Run the build**

Run: `cd ~/tariff-partner-portal && npx next build 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and verify**

Run: `cd ~/tariff-partner-portal && npm run dev`

Manual checks:
- Log in as a partner → see ServiceSwitcher in sidebar
- Switch between Tariff / R&D / All Services
- Deals page filters by active service
- Submit Client page shows iframe for tariff, native form for R&D
- `/recover/rd-credits` loads the R&D landing page
- `/recover` redirects to `/recover/tariff`
- Admin → Services page lists both services

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: build verification — multi-service partner portal complete"
```

---

## Summary

| Task | What it does |
|------|-------------|
| 1 | Prisma schema: Service model, PartnerServiceRate, serviceId FKs, backfill migration |
| 2 | Service helper library (getActiveServices, getCommissionRate, getStageLabels) |
| 3 | Fulfillment router (webhook POST for internal services) |
| 4 | GET /api/services endpoint |
| 5 | ServiceContext + ServiceSwitcher React components |
| 6 | Wire ServiceProvider into partner layout |
| 7 | Extend webhook/referral with service resolution + fulfillment routing |
| 8 | Inbound service-update webhook (R&D app → partner portal) |
| 9 | Add serviceId filtering to deals/commissions/training APIs |
| 10 | Service-aware filtering on all partner dashboard pages |
| 11 | Dynamic landing pages at /recover/[serviceSlug] |
| 12 | Admin service management CRUD + service filter on admin deals |
| 13 | Service-aware submit client form |
| 14 | Build verification + manual testing |
