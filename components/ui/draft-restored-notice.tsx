"use client";

import { draftSavedAgo } from "@/lib/form-draft";
import { secondaryButton } from "@/components/profile/styles";
import { cn } from "@/lib/utils";

/** Says a saved draft came back, and offers to throw it away. Renders inside the form it restores. */
export function DraftRestoredNotice({
  savedAt,
  onStartOver,
}: {
  savedAt: number;
  onStartOver: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[var(--color-secondary-sky)] p-4 text-sm text-[var(--color-primary-deep)]"
    >
      <p className="text-pretty">
        Restored your draft from {draftSavedAgo(savedAt)}.
      </p>
      <button
        type="button"
        onClick={onStartOver}
        className={cn(secondaryButton, "min-h-11 px-4")}
      >
        Start over
      </button>
    </div>
  );
}
