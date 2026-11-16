import { MapPin } from "lucide-react";
import { card } from "@/components/profile/styles";
import { formatDistanceKm } from "@/lib/browse";
import { cn } from "@/lib/utils";
import { RatingInline, TutorInitial } from "./browse-ui";

export interface TutorResult {
  id: string;
  name: string;
  ratingAvg: number;
  ratingCount: number;
  areas?: { id: number; name: string }[];
  subjects?: { id: number; name: string }[];
  /** Present only in the nearby list. */
  distanceMeters?: number;
}

/** Renders an `<li>`; the parent list is a `<ul>`. There is no tutor profile page yet, so no link. */
export function TutorResultCard({ tutor }: { tutor: TutorResult }) {
  const distance =
    tutor.distanceMeters !== undefined
      ? formatDistanceKm(tutor.distanceMeters / 1000)
      : "";
  const chips = [
    ...(tutor.areas ?? []).map((a) => ({ key: `area-${a.id}`, label: a.name })),
    ...(tutor.subjects ?? []).map((s) => ({
      key: `subject-${s.id}`,
      label: s.name,
    })),
  ];

  return (
    <li className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="flex items-center gap-3">
        <TutorInitial name={tutor.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[var(--color-neutral-charcoal)]">
            {tutor.name}
          </h3>
          <RatingInline
            ratingAvg={tutor.ratingAvg}
            ratingCount={tutor.ratingCount}
          />
        </div>
      </div>

      {distance && (
        <p className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <MapPin aria-hidden="true" className="size-4" />
          <span className="tabular-nums">{distance}</span> away
        </p>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Areas and subjects">
          {chips.map((chip) => (
            <li
              key={chip.key}
              className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {chip.label}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
