import type { ReactNode } from "react";
import MarketingAtmosphere from "./MarketingAtmosphere";

/**
 * Full-page OLED marketing wrapper. Renders the `.oc-launch` scope (near-black
 * #050507, Syne/Geist fonts, violet token palette) with the grid + glow
 * atmosphere behind a `relative z-10` content layer.
 *
 * Use for pages you build/convert cleanly. For pages with a complex existing
 * root (data fetching on `<main>`, etc.) prefer adding `oc-launch oc-grid
 * relative overflow-hidden` to that root and dropping <MarketingAtmosphere />
 * in directly.
 *
 * `as` lets the caller pick the semantic element (defaults to <main>).
 */
export default function MarketingShell({
  children,
  className = "",
  as: Tag = "main",
}: {
  children: ReactNode;
  className?: string;
  as?: "main" | "div";
}) {
  return (
    <Tag className={`oc-launch oc-grid relative min-h-screen overflow-hidden bg-[#050507] text-white ${className}`}>
      <MarketingAtmosphere />
      <div className="relative z-10">{children}</div>
    </Tag>
  );
}
