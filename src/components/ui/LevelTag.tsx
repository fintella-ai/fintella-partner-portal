/**
 * LevelTag — color-coded partner-tier badge.
 *
 *   L1 → gold    (top of the downline, direct firm relationship)
 *   L2 → silver  (recruited by an L1)
 *   L3 → bronze  (recruited by an L2, only when L3 is enabled)
 *
 * Used anywhere a partner's tier is surfaced — partners table, partner
 * detail header, level filter chips. Single source of truth so the
 * palette stays consistent if we later tweak the shades.
 */

type Tier = "l1" | "l2" | "l3";

const STYLES: Record<Tier, string> = {
  // Gold — matches the brand's brand-gold accent elsewhere
  l1: "bg-[rgba(196,160,80,0.18)] text-[#d4b060] border border-[rgba(196,160,80,0.5)]",
  // Silver
  l2: "bg-[rgba(200,205,215,0.14)] text-[#d7dbe3] border border-[rgba(200,205,215,0.35)]",
  // Bronze
  l3: "bg-[rgba(184,115,51,0.15)] text-[#d99a6c] border border-[rgba(184,115,51,0.45)]",
};

export interface LevelTagProps {
  tier?: string | null;
  /** Visual size. "sm" ≈ 11px chip (tables); "xs" ≈ 10px (mobile). */
  size?: "xs" | "sm";
  className?: string;
}

export default function LevelTag({ tier, size = "sm", className = "" }: LevelTagProps) {
  const t = (tier || "l1").toLowerCase() as Tier;
  const style = STYLES[t] || STYLES.l1;
  const sizeCls = size === "xs"
    ? "text-[10px] px-1.5 py-0.5"
    : "text-[11px] px-2 py-0.5";
  return (
    <span
      className={`inline-block font-mono font-semibold rounded ${sizeCls} ${style} ${className}`}
    >
      {t.toUpperCase()}
    </span>
  );
}
