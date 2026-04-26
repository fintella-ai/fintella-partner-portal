"use client";

import { useEditLayout } from "@/components/admin/EditLayoutContext";
import { useDevice } from "@/lib/useDevice";

export default function EditLayoutButton() {
  const { canEdit, editMode, toggleEditMode } = useEditLayout();
  const device = useDevice();

  if (!canEdit || device.isMobile) return null;

  return (
    <button
      onClick={toggleEditMode}
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[1001] font-body text-[10px] font-semibold tracking-[1px] uppercase rounded-full px-4 py-1.5 transition-all shadow-lg ${
        editMode
          ? "bg-brand-gold text-black hover:bg-yellow-400"
          : "bg-black/70 backdrop-blur-sm border border-brand-gold/30 text-brand-gold hover:bg-black/90"
      }`}
    >
      {editMode ? "✓ Done Editing" : "✎ Edit Layout"}
    </button>
  );
}
