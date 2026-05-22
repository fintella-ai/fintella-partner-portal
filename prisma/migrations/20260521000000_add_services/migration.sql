-- AlterTable
ALTER TABLE "CommissionLedger" ADD COLUMN     "serviceId" TEXT;

-- AlterTable
ALTER TABLE "TrainingModule" ADD COLUMN     "serviceId" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "serviceFields" JSONB,
ADD COLUMN     "serviceId" TEXT;

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "l2RateMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    "l3RateMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    "firmFeeRate" DOUBLE PRECISION,
    "formFieldsConfig" JSONB,
    "fulfillmentType" TEXT NOT NULL DEFAULT 'external',
    "webhookUrl" TEXT,
    "webhookHeaders" JSONB,
    "landingPageSlug" TEXT,
    "landingPageContent" JSONB,
    "stages" JSONB,
    "accentColor" TEXT,
    "iconEmoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerServiceRate" (
    "id" TEXT NOT NULL,
    "partnerCode" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerServiceRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerServiceRate_partnerCode_serviceId_key" ON "PartnerServiceRate"("partnerCode", "serviceId");

-- CreateIndex
CREATE INDEX "Deal_serviceId_idx" ON "Deal"("serviceId");

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingModule" ADD CONSTRAINT "TrainingModule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerServiceRate" ADD CONSTRAINT "PartnerServiceRate_partnerCode_fkey" FOREIGN KEY ("partnerCode") REFERENCES "Partner"("partnerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerServiceRate" ADD CONSTRAINT "PartnerServiceRate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
