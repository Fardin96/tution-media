import type { CSSProperties } from "react";
import Link from "next/link";
import { GraduationCap, MapPin } from "lucide-react";
import { card, focusRing } from "@/components/profile/styles";
import { formatDistanceKm } from "@/lib/browse";
import { cn } from "@/lib/utils";
import { RatingInline, TutorInitial } from "./browse-ui";

export interface TutorResult {
  id: string;
  name: string;
  instituteName?: string | null;
  ratingAvg: number;
  ratingCount: number;
  areas?: { id: number; name: string }[];
  subjects?: { id: number; name: string }[];
  /** Present only in the nearby list. */
  distanceMeters?: number;
}

/**
 * Renders an `<li>`; the parent list is a `<ul>`. The name link stretches over
 * the whole card, so clicking anywhere on the card opens the tutor's profile.
 */
export function TutorResultCard({
  tutor,
  className,
  style,
}: {
  tutor: TutorResult;
  className?: string;
  style?: CSSProperties;
}) {
  const institute = tutor.instituteName?.trim();
  const areaNames = (tutor.areas ?? []).map((a) => a.name).join(", ");
  const distance =
    tutor.distanceMeters !== undefined
      ? formatDistanceKm(tutor.distanceMeters / 1000)
      : "";
  const subjects = tutor.subjects ?? [];

  return (
    <li
      className={cn(card, "relative flex flex-col gap-4 p-5", className)}
      style={style}
    >
      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <TutorInitial name={tutor.name} />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <h3 className="truncate font-semibold text-[var(--color-neutral-charcoal)]">
              <Link
                href={`/tutors/${tutor.id}`}
                className={cn(
                  "rounded-sm after:absolute after:inset-0 after:rounded-[24px] hover:underline",
                  focusRing,
                )}
              >
                {tutor.name}
              </Link>
            </h3>
            <div className="shrink-0">
              <RatingInline
                ratingAvg={tutor.ratingAvg}
                ratingCount={tutor.ratingCount}
              />
            </div>
          </div>
        </div>

        {institute && (
          <p className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
            <GraduationCap
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0">{institute}</span>
          </p>
        )}

        {(areaNames || distance) && (
          <p className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              {areaNames}
              {areaNames && distance && " · "}
              {distance && (
                <>
                  <span className="tabular-nums">{distance}</span> away
                </>
              )}
            </span>
          </p>
        )}
      </div>

      {subjects.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Subjects">
          {subjects.map((subject) => (
            <li
              key={subject.id}
              className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {subject.name}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
