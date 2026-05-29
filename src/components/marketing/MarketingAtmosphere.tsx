import type { CSSProperties } from "react";

/**
 * Drop-in OLED atmosphere layer: a faint top-masked grid + three soft violet
 * glow blobs. Renders absolutely-positioned, z-0, pointer-events-none, so it
 * sits *behind* page content. Place it as the FIRST child of a `relative
 * overflow-hidden` root that also carries the `oc-launch oc-grid` classes,
 * then wrap the real content in a sibling `<div className="relative z-10">`.
 *
 * Scoped to the marketing shell only — see globals.css `.oc-launch`.
 */
const blob = (style: CSSProperties): CSSProperties => style;

export default function MarketingAtmosphere({ withGrid = false }: { withGrid?: boolean }) {
  return (
    <>
      {/* Grid lines (only when the parent can't use the .oc-grid ::before) */}
      {withGrid && <div className="oc-grid-lines" aria-hidden="true" />}
      <div
        aria-hidden="true"
        className="oc-blob oc-blob--violet oc-blob--drift"
        style={blob({ top: "-12%", right: "-6%", width: 620, height: 620 })}
      />
      <div
        aria-hidden="true"
        className="oc-blob oc-blob--sky"
        style={blob({ top: "28%", left: "-14%", width: 520, height: 520 })}
      />
      <div
        aria-hidden="true"
        className="oc-blob oc-blob--fuchsia oc-blob--drift"
        style={blob({ bottom: "-14%", left: "32%", width: 560, height: 560, animationDelay: "-9s" })}
      />
    </>
  );
}
