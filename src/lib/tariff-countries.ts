// ---------------------------------------------------------------------------
// Tariff Intelligence Engine — Country flags & IEEPA date constants
// ---------------------------------------------------------------------------

export const COUNTRY_FLAGS: Record<string, string> = {
  CN: "🇨🇳", CA: "🇨🇦", MX: "🇲🇽", VN: "🇻🇳", TW: "🇹🇼", IN: "🇮🇳",
  JP: "🇯🇵", KR: "🇰🇷", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", GB: "🇬🇧",
  TH: "🇹🇭", ID: "🇮🇩", MY: "🇲🇾", BD: "🇧🇩", KH: "🇰🇭", PH: "🇵🇭",
  PK: "🇵🇰", LK: "🇱🇰", MM: "🇲🇲", LA: "🇱🇦", IL: "🇮🇱", JO: "🇯🇴",
  AU: "🇦🇺", BR: "🇧🇷", NO: "🇳🇴", CH: "🇨🇭", SE: "🇸🇪", FI: "🇫🇮",
  DK: "🇩🇰", NL: "🇳🇱", BE: "🇧🇪", ES: "🇪🇸", PT: "🇵🇹", AT: "🇦🇹",
  IE: "🇮🇪", PL: "🇵🇱", CZ: "🇨🇿", HU: "🇭🇺", RO: "🇷🇴", GR: "🇬🇷",
  TR: "🇹🇷", ZA: "🇿🇦", NG: "🇳🇬", EG: "🇪🇬", SA: "🇸🇦", AE: "🇦🇪",
  SG: "🇸🇬", NZ: "🇳🇿", CL: "🇨🇱", CO: "🇨🇴", AR: "🇦🇷", PE: "🇵🇪",
};

export function getCountryFlag(code: string): string {
  return COUNTRY_FLAGS[code.toUpperCase()] || "🏳️";
}

/** Date the IEEPA tariffs were formally terminated (Executive Order) */
export const IEEPA_TERMINATION_DATE = new Date("2026-02-24T00:00:00Z");

/** First date entries may qualify for IEEPA refund */
export const IEEPA_START_DATE = new Date("2025-02-01T00:00:00Z");

/** Last date entries may qualify for IEEPA refund */
export const IEEPA_END_DATE = new Date("2026-02-23T23:59:59Z");
