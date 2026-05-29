import type { ReactNode } from "react";

/**
 * Presentational OLED marketing primitives. All server-safe (no "use client"),
 * thin wrappers over the scoped `.oc-*` utility classes in globals.css so they
 * only render correctly inside an `.oc-launch` ancestor.
 */

/** Small uppercase violet label that sits above a headline. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`oc-eyebrow ${className}`}>{children}</div>;
}

/** Inline violet→sky→cyan gradient text. Wrap the accented words of a headline. */
export function GradientText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`oc-gradient-text ${className}`}>{children}</span>;
}

/** Frosted glass surface. `hover` adds the violet lift-on-hover treatment. */
export function GlassCard({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`oc-glass ${hover ? "oc-glass--hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** Centered stat block: big value + small label, inside a glass card. */
export function StatCard({
  value,
  label,
  className = "",
}: {
  value: ReactNode;
  label: ReactNode;
  className?: string;
}) {
  return (
    <div className={`oc-glass p-6 text-center ${className}`}>
      <div className="oc-stat-value">{value}</div>
      <div className="mt-1 text-sm text-white/50">{label}</div>
    </div>
  );
}

/** Violet icon chip for feature rows. Pass an icon/emoji/SVG as children. */
export function FeatureIcon({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`oc-feature-icon ${className}`}>{children}</div>;
}
