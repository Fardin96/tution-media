"use client";

import { useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/profile/profile-fields";
import { ghostButton } from "@/components/profile/styles";
import { PendingLabel } from "@/components/ui/pending-label";
import { formatRadius, useTutorZones } from "@/lib/tutor-zones";

const ZONES_HREF = "/dashboard/tutor/zones";
const hintClass = "text-sm text-[var(--color-text-secondary)]";
const linkClass = cn(ghostButton, "min-h-10 px-3");

interface ZonePickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  teachesOnline: boolean;
  idPrefix: string;
  /** Shown when there is no zone and no online teaching; empty hides it. Defaults to the set wording. */
  emptyHint?: string;
}

export function ZonePicker({
  value,
  onChange,
  teachesOnline,
  idPrefix,
  emptyHint = "To make this your default for applying, pick at least one zone or turn on online teaching.",
}: ZonePickerProps) {
  const zonesQuery = useTutorZones();
  const zones = zonesQuery.data?.zones;
  const hintId = `${idPrefix}-zones-hint`;

  // A zone deleted elsewhere is already gone from the server's set, so drop it here
  // too, or the next save would fail with INVALID_SUBJECT_OR_ZONE.
  useEffect(() => {
    if (!zones) return;
    const known = new Set(zones.map((z) => z.id));
    if (value.some((id) => !known.has(id))) {
      onChange(value.filter((id) => known.has(id)));
    }
  }, [zones, value, onChange]);

  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );

  const manageLink = (
    <Link href={ZONES_HREF} className={linkClass}>
      Manage zones
    </Link>
  );

  if (zonesQuery.isPending) {
    return (
      <p role="status" className={hintClass}>
        Loading your zones…
      </p>
    );
  }

  if (zonesQuery.isError) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className={hintClass}>Couldn&apos;t load your zones.</p>
          <button
            type="button"
            onClick={() => void zonesQuery.refetch()}
            disabled={zonesQuery.isFetching}
            aria-busy={zonesQuery.isFetching || undefined}
            className={linkClass}
          >
            <PendingLabel pending={zonesQuery.isFetching}>
              Try again
            </PendingLabel>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">{manageLink}</div>
      </div>
    );
  }

  const list = zones ?? [];

  return (
    <div className="grid gap-4">
      {list.length > 0 ? (
        <div
          role="group"
          aria-label="Teaching zones"
          aria-describedby={
            !teachesOnline && value.length === 0 && emptyHint
              ? hintId
              : undefined
          }
          className="flex flex-wrap gap-2"
        >
          {list.map((zone) => (
            <Chip
              key={zone.id}
              type="checkbox"
              name={`${idPrefix}-zoneIds`}
              label={`${zone.label} · ${formatRadius(zone.radiusM)}`}
              checked={value.includes(zone.id)}
              onChange={() => toggle(zone.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className={hintClass}>You haven&apos;t added any zones yet.</p>
          <Link href={ZONES_HREF} className={linkClass}>
            Add a zone
          </Link>
        </div>
      )}

      {!teachesOnline && value.length === 0 && emptyHint && (
        <p id={hintId} className={hintClass}>
          {emptyHint}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">{manageLink}</div>
    </div>
  );
}
