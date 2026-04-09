import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deals = [
    // John Orlando's direct deals
    { id: "deal-1", dealName: "Acme Electronics Import LLC", partnerCode: "PTNJRO001", clientName: "Acme Electronics", clientEmail: "contact@acme-electronics.com", stage: "engaged", productType: "ieepa", importedProducts: "Consumer electronics", estimatedRefundAmount: 180000, firmFeeRate: 0.20, firmFeeAmount: 36000, l1CommissionAmount: 7200, l1CommissionStatus: "pending", l2CommissionAmount: 0, l2CommissionStatus: "pending" },
    { id: "deal-2", dealName: "Pacific Textile Group", partnerCode: "PTNJRO001", clientName: "Pacific Textile Group", clientEmail: "info@pacifictextile.com", stage: "closedwon", productType: "ieepa", importedProducts: "Textiles & apparel", estimatedRefundAmount: 60000, firmFeeRate: 0.20, firmFeeAmount: 12000, l1CommissionAmount: 2400, l1CommissionStatus: "paid", l2CommissionAmount: 0, l2CommissionStatus: "pending", closeDate: new Date("2026-02-28") },
    { id: "deal-3", dealName: "Metro Steel Distributors", partnerCode: "PTNJRO001", clientName: "Metro Steel Distributors", clientEmail: "sales@metrosteel.com", stage: "consultation_booked", productType: "ieepa", importedProducts: "Steel & aluminum", estimatedRefundAmount: 95000, firmFeeRate: 0.25, firmFeeAmount: 23750, l1CommissionAmount: 4750, l1CommissionStatus: "pending", l2CommissionAmount: 0, l2CommissionStatus: "pending" },
    // Sarah Chen's deals (downline of John)
    { id: "deal-4", dealName: "Global Auto Parts Inc.", partnerCode: "PTNSC8K2F", clientName: "Global Auto Parts", clientEmail: "info@globalauto.com", stage: "qualified", productType: "ieepa", importedProducts: "Auto parts", estimatedRefundAmount: 45000, firmFeeRate: 0.20, firmFeeAmount: 9000, l1CommissionAmount: 1800, l1CommissionStatus: "pending", l2CommissionAmount: 450, l2CommissionStatus: "pending" },
    // Mike Torres's deals (downline of John)
    { id: "deal-5", dealName: "Summit Furniture Co.", partnerCode: "PTNMT3X7Q", clientName: "Summit Furniture", clientEmail: "ops@summitfurniture.com", stage: "engaged", productType: "ieepa", importedProducts: "Furniture imports", estimatedRefundAmount: 128000, firmFeeRate: 0.20, firmFeeAmount: 25600, l1CommissionAmount: 5120, l1CommissionStatus: "pending", l2CommissionAmount: 1280, l2CommissionStatus: "pending" },
    // David Kim's deal (downline of Sarah, L3 for John)
    { id: "deal-6", dealName: "Coastal Imports LLC", partnerCode: "PTNDK5M8J", clientName: "Coastal Imports", clientEmail: "hello@coastalimports.com", stage: "contacted", productType: "section301", importedProducts: "Marine equipment", estimatedRefundAmount: 72000, firmFeeRate: 0.18, firmFeeAmount: 12960, l1CommissionAmount: 2592, l1CommissionStatus: "pending", l2CommissionAmount: 648, l2CommissionStatus: "pending" },
    // Rachel Wong's deal
    { id: "deal-7", dealName: "Brightstar Technologies", partnerCode: "PTNRW2N6T", clientName: "Brightstar Tech", clientEmail: "info@brightstar.tech", stage: "closedwon", productType: "ieepa", importedProducts: "Semiconductor equipment", estimatedRefundAmount: 240000, firmFeeRate: 0.22, firmFeeAmount: 52800, l1CommissionAmount: 13200, l1CommissionStatus: "paid", l2CommissionAmount: 2640, l2CommissionStatus: "pending", closeDate: new Date("2026-03-15") },
  ];

  for (const d of deals) {
    const result = await prisma.deal.upsert({
      where: { id: d.id },
      update: {},
      create: {
        ...d,
        closeDate: d.closeDate || null,
      },
    });
    console.log(`Upserted: ${result.id} — ${result.dealName} (${result.partnerCode})`);
  }

  console.log(`\nSeed complete: ${deals.length} deals.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
