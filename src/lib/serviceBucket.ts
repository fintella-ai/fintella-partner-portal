// Service-of-interest bucketing for the deal-view service switcher.
//
// Deals are stored with several `serviceOfInterest` string variants:
//   - "Tariff Refund Support"            (legacy / CSV import / manual)
//   - "Tariff Refund Support (Tier 1)"   (webhook + admin edit + upgrade-tier — the bulk of deals)
//   - "Tariff Refund Support (Tier 2)"
//   - "IEEPA Tariff Refund (DIY)"        (self-serve tariff engagement)
//   - "Kwong Penalty Abatement (ERC)"    (Kwong intake / SignWell)
//   - null                               (older rows)
//
// The service switcher only has two real buckets ("Tariff Refund Support" and
// "Kwong Penalty Abatement (ERC)"), so an exact-string match silently dropped
// every tier-suffixed / DIY / null deal — showing ~13 of ~121. Normalize to the
// bucket so the tab COUNT and the FILTER always agree.

export const ERC_SERVICE = "Kwong Penalty Abatement (ERC)";
export const TARIFF_REFUND_BUCKET = "Tariff Refund Support";

export function serviceBucket(serviceOfInterest: string | null | undefined): string {
  return serviceOfInterest === ERC_SERVICE ? ERC_SERVICE : TARIFF_REFUND_BUCKET;
}
