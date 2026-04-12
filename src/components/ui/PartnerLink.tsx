"use client";

import { useRouter } from "next/navigation";

/**
 * Clickable partner name link — navigates to admin partner profile.
 * Renders as an inline element styled like surrounding text but with
 * a gold hover underline to indicate clickability.
 */
export default function PartnerLink({
  partnerId,
  children,
  className = "",
}: {
  partnerId: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  if (!partnerId) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/admin/partners/${partnerId}`);
      }}
      className={`text-left hover:text-brand-gold hover:underline underline-offset-2 transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
