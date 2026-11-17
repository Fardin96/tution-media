"use client";

import { MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  ListingCard,
  accentAt,
  listingTitleClass,
} from "@/components/ui/listing-card";
import { formatRadius, zoneUsageText, type TutorZone } from "@/lib/tutor-zones";

interface ZoneListProps {
  zones: TutorZone[];
  selectedId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onEdit: (zone: TutorZone) => void;
  onDelete: (zone: TutorZone) => void;
  onAdd: () => void;
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
      {zones.map((zone, index) => {
        const selected = zone.id === selectedId;
        return (
          <li key={zone.id}>
            <ListingCard
              icon={MapPin}
              accent={accentAt(index)}
              selected={selected}
              title={
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(zone.id)}
                  className={cn(
                    "block w-full rounded-[12px] text-start",
                    focusRing,
                  )}
                >
                  <span className={cn(listingTitleClass, "block")}>
                    {zone.label}
                  </span>
                </button>
              }
              body={zone.addressText}
              meta={zoneUsageText(zone)}
              figure={formatRadius(zone.radiusM)}
              actions={
                <>
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
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
