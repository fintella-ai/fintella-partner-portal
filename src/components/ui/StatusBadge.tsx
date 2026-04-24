import { COMMISSION_STATUS_COLORS, COMMISSION_STATUS_LABELS } from "@/lib/constants";

export default function StatusBadge({ status }: { status?: string }) {
  const key = status?.toLowerCase() || "";
  const c = COMMISSION_STATUS_COLORS[key] || "#6b7280";
  // Prefer the canonical display label (Pending Payment / Projected / …)
  // over the raw status string so partners + admins see the same copy
  // regardless of where the row comes from.
  const label = COMMISSION_STATUS_LABELS[key] || status || "Pending Payment";

  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 font-body text-[10px] font-semibold tracking-wider uppercase"
      style={{
        background: c + "22",
        color: c,
        border: `1px solid ${c}44`,
      }}
    >
      {label}
    </span>
  );
}
