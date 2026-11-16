"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { formatRadius, type TutorZone } from "@/lib/tutor-zones";

interface ZoneListProps {
  zones: TutorZone[];
  selectedId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onEdit: (zone: TutorZone) => void;
  onDelete: (zone: TutorZone) => void;
  onAdd: () => void;
}

function setsText(count: number) {
  if (count === 0) return "Not used by any set";
  if (count === 1) return "Used by 1 set";
  return `Used by ${count} sets`;
}

export function ZoneList({
  zones,
  selectedId,
  canAdd,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
}: ZoneListProps) {
  if (zones.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-start gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-5">
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          No zones yet
        </p>
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          Add the areas where you can teach in person.
        </p>
        {canAdd && (
          <button type="button" onClick={onAdd} className={primaryButton}>
            <Plus aria-hidden="true" className="size-4" />
            Add your first zone
          </button>
        )}
      </div>
    );
  }

  return (
    <ul aria-label="Your zones" className="mt-4 grid gap-3">
      {zones.map((zone) => {
        const selected = zone.id === selectedId;
        return (
          <li
            key={zone.id}
            className={cn(
              "flex flex-wrap items-start justify-between gap-3 rounded-[16px] p-4 transition-[background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
              selected
                ? "bg-[var(--color-secondary-sky)] shadow-[inset_0_0_0_1px_var(--color-primary-core)]"
                : "bg-[var(--color-neutral-off-white)]",
            )}
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(zone.id)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-start gap-1 rounded-[12px] text-start",
                focusRing,
              )}
            >
              <span className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
                {zone.label}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {formatRadius(zone.radiusM)}
                {" · "}
                {setsText(zone.requirementIds.length)}
              </span>
              {zone.addressText && (
                <span className="text-sm text-pretty text-[var(--color-text-secondary)]">
                  {zone.addressText}
                </span>
              )}
            </button>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onEdit(zone)}
                aria-label={`Edit ${zone.label}`}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(zone)}
                aria-label={`Delete ${zone.label}`}
                className={cn(
                  secondaryButton,
                  "min-h-10 px-4 text-[var(--color-semantic-error-text)]",
                )}
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
