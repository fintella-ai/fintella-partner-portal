# Multi-Service Partner Portal — Design Spec

**Date:** 2026-05-21
**Author:** John Orlando + Claude
**Status:** Draft

## Problem

The partner portal is hardcoded to one service: IEEPA tariff refund claims fulfilled by Frost Law. Fintella is adding R&D Tax Credits as an internally-fulfilled service, with 3-5 total services planned. Partners need separate submission links, training, and deal tracking per service, plus a unified rollup view across all services.

## Design

### Service Model

A new `Service` table is the central registry. Every service-scoped entity (deals, training, landing pages) gets a `serviceId` FK.

```prisma
model Service {
  id                    String   @id @default(cuid())
  slug                  String   @unique   // "tariff-refund", "rd-credits"
  name                  String              // "Tariff Refund", "R&D Tax Credits"
  shortName             String?             // "Tariff", "R&D" (for badges/chips)
  description           String?
  active                Boolean  @default(true)

  // Commission defaults (partners can override via per-service rate)
  defaultCommissionRate Float    @default(0.25)  // L1 rate
  l2RateMultiplier      Float    @default(0.50)  // L2 = L1 * this
  l3RateMultiplier      Float    @default(0.50)  // L3 = L2 * this
  firmFeeRate           Float?                   // default firm fee for estimates

  // Form configuration
  formFieldsConfig      Json?    // array of { key, label, type, required, options? }
  // Fields NOT in formFieldsConfig are the shared base fields (name, email, phone,
  // legal entity, EIN, address). formFieldsConfig defines service-specific additions.

  // Fulfillment routing
  fulfillmentType       String   @default("external")  // "external" | "internal"
  webhookUrl            String?  // where to POST deals (Frost Law API, Supabase app, etc.)
  webhookHeaders        Json?    // { "Authorization": "Bearer xxx" } — encrypted at rest

  // Landing page
  landingPageSlug       String?  // "/recover/rd-credits" — public submission page
  landingPageContent    Json?    // hero, stats, testimonials, FAQ — same shape as RecoverPageContent

  // Deal stages (service-specific pipeline)
  stages                Json?    // [{ key: "lead_submitted", label: "Lead Submitted", color: "#6b7280" }, ...]
  // If null, falls back to the global STAGE_LABELS in constants.ts

  // Branding
  accentColor           String?  // hex color for badges/chips
  iconEmoji             String?  // "shield" | "flask" | "calculator"

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  deals                 Deal[]
  trainingModules       TrainingModule[]
  partnerRates          PartnerServiceRate[]
  commissionEntries     CommissionLedger[]
}
```

### Schema Changes to Existing Models

**Deal** — add `serviceId`:
```prisma
model Deal {
  // ... existing fields ...
  serviceId     String?         // FK to Service. Nullable for backfill; NOT NULL after migration.
  service       Service?        @relation(fields: [serviceId], references: [id])
  // productType stays for backward compat but serviceId is the source of truth.
}
```

**TrainingModule** — add `serviceId`:
```prisma
model TrainingModule {
  // ... existing fields ...
  serviceId     String?
  service       Service?        @relation(fields: [serviceId], references: [id])
}
```

**Partner** — add per-service commission overrides:
```prisma
model PartnerServiceRate {
  id            String   @id @default(cuid())
  partnerCode   String
  serviceId     String
  commissionRate Float   // overrides Service.defaultCommissionRate for this partner
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  partner       Partner  @relation(fields: [partnerCode], references: [partnerCode])
  service       Service  @relation(fields: [serviceId], references: [id])

  @@unique([partnerCode, serviceId])
}
```

**CommissionLedger** — add `serviceId` for reporting:
```prisma
model CommissionLedger {
  // ... existing fields ...
  serviceId     String?
  service       Service?   @relation(fields: [serviceId], references: [id])
}
```

### Migration Plan

1. Create `Service` table + `PartnerServiceRate` table
2. Seed two services: `tariff-refund` (fulfillmentType=external, webhookUrl=Frost) and `rd-credits` (fulfillmentType=internal, webhookUrl=Supabase R&D app)
3. Add `serviceId` column (nullable) to `Deal`, `TrainingModule`, `CommissionLedger`
4. Backfill: `UPDATE "Deal" SET "serviceId" = '<tariff-service-id>' WHERE "serviceId" IS NULL`
5. Same for `TrainingModule`, `CommissionLedger`
6. Make `serviceId` NOT NULL on `Deal` (after backfill)

### Service Switcher (Partner Portal UI)

**Location:** Sidebar, above the nav items. Dropdown showing service badges.

**Behavior:**
- On login, defaults to the partner's primary service (or the first active service)
- Selecting a service stores it in `localStorage` as `activeServiceId` and re-fetches all data
- All API calls include `?serviceId=xxx` query param (or read from a React context)
- An "All Services" option at the bottom of the dropdown shows unified reporting

**Affected pages when service changes:**
| Page | Behavior |
|------|----------|
| Dashboard | KPIs scoped to active service |
| Submit Client | Form fields change per service.formFieldsConfig |
| My Deals | Filtered by serviceId |
| Downline Deals | Filtered by serviceId |
| Reporting | Filtered by serviceId; "All Services" shows rollup with service badge column |
| Training | Modules filtered by serviceId |
| Commissions | Filtered by serviceId; "All Services" shows rollup |
| Documents | Unaffected (agreements are partner-level, not service-level) |
| Settings | Unaffected |
| Referral Links | Shows per-service links (each service gets its own referral URL) |

### Client Submission Flow

**Per-service landing pages:**
- `/recover/tariff` — existing tariff landing page (rename from `/recover`)
- `/recover/rd-credits` — new R&D credits landing page
- Each reads content from `Service.landingPageContent` or falls back to admin landing page builder
- Partner referral links become: `https://fintella.partners/recover/rd-credits?ref=PARTNER_CODE`

**Submission endpoint:**
- `POST /api/webhook/referral` — existing endpoint, extended:
  - New field: `serviceSlug` (or `serviceId`) in the POST body
  - If missing, defaults to `tariff-refund` (backward compat)
  - Looks up `Service` by slug, applies service-specific defaults (commission rate, firm fee)
  - If `fulfillmentType = 'internal'`, POSTs the deal data to `service.webhookUrl` after creating the Deal row
  - If `fulfillmentType = 'external'`, existing Frost Law webhook behavior (unchanged)

**R&D-specific form fields** (stored in `Service.formFieldsConfig`):
```json
[
  { "key": "annualRdSpend", "label": "Annual R&D Spend", "type": "select", "required": true,
    "options": ["Under $100K", "$100K - $500K", "$500K - $1M", "$1M - $5M", "$5M+"] },
  { "key": "employeeCount", "label": "Number of Employees", "type": "select", "required": true,
    "options": ["1-10", "11-50", "51-200", "201-500", "500+"] },
  { "key": "industry", "label": "Industry", "type": "select", "required": true,
    "options": ["Software/Tech", "Manufacturing", "Biotech/Pharma", "Engineering", "Food Science", "Agriculture", "Other"] },
  { "key": "rdActivities", "label": "Describe Your R&D Activities", "type": "textarea", "required": true },
  { "key": "previouslyClaimed", "label": "Have You Previously Claimed R&D Credits?", "type": "select", "required": false,
    "options": ["Yes", "No", "Not Sure"] }
]
```

Fields dropped from tariff form for R&D: `importsGoods`, `importCountries`, `annualImportValue`, `importerOfRecord`, `isImporterOfRecord`, `importedProducts`.

Service-specific fields are stored in `Deal.rawPayload` (JSON) or as a new `Deal.serviceFields` JSON column.

### Commission Calculation

When a deal is created:
1. Look up `PartnerServiceRate` for `(partnerCode, serviceId)` — if exists, use that rate
2. Else use `Service.defaultCommissionRate`
3. L2/L3 multipliers come from the Service row
4. Rest of the commission lifecycle (pending → due → paid) is unchanged

### Internal Fulfillment Webhook (R&D App)

When `fulfillmentType = 'internal'` and a deal is created or updated:

```
POST {service.webhookUrl}
Headers: { ...service.webhookHeaders }
Body: {
  event: "deal.created" | "deal.updated",
  deal: { id, dealName, stage, clientEmail, ... all Deal fields },
  partner: { partnerCode, firstName, lastName, email },
  service: { slug, name }
}
```

The R&D Supabase app receives this and creates its own project/engagement record. Status updates flow back via a reciprocal webhook: `POST /api/webhook/service-update` on the partner portal, updating the Deal's `stage` and `externalStage`.

### Admin Changes

**Admin deal list:** Add a "Service" column with colored badge. Filter dropdown at top: "All Services" | "Tariff Refund" | "R&D Credits".

**Admin settings:** New "Services" tab under Settings to manage the service registry (CRUD services, edit form fields, set commission rates, configure webhooks).

**Admin training:** Filter modules by service when editing.

### Referral Links

Partner referral links page shows a card per active service:

```
Tariff Refund:  https://fintella.partners/recover/tariff?ref=PTNJRO001
R&D Credits:    https://fintella.partners/recover/rd-credits?ref=PTNJRO001
```

Each link copies to clipboard. Partner can also get a "general" link that goes to a service picker page.

## Out of Scope (for this phase)

- Per-service SignWell agreement templates (all services use the same partnership agreement)
- Per-service branding/theming beyond accent color + icon
- Service-specific partner tiers (all services share the L1/L2/L3 structure)
- White-label/multi-tenant service configuration (future phase)

## Testing

- Create `tariff-refund` and `rd-credits` services via seed/migration
- Submit a test R&D deal through the new landing page — verify it creates a Deal with correct serviceId
- Verify internal webhook fires to the configured URL
- Switch services in the partner portal — verify all pages filter correctly
- Check "All Services" rollup shows deals from both services
- Backfill migration: verify all existing deals get `serviceId = tariff-refund`
