import type { ReactNode } from "react";
import { Layers } from "lucide-react";
import { TonePill } from "@/components/applications/status-pill";
import {
  ListingCard,
  listingTitleClass,
  type ListingAccent,
} from "@/components/ui/listing-card";
import { cn } from "@/lib/utils";
import {
  combinedLevelLabel,
  curriculumOf,
  type EducationLookup,
} from "@/lib/education";
import { formatTaka } from "@/lib/requirements";
import {
  daysSummary,
  formatTimeRange,
  type TutorRequirement,
} from "@/lib/tutor-requirements";

const CURRICULUM_COUNT = 7;

/** Level label across the chosen curricula, falling back to the bare number while the lookup loads. */
function levelText(
  lookup: EducationLookup | undefined,
  set: TutorRequirement,
  level: number,
): string {
  return combinedLevelLabel(lookup, set.curricula, level) || `Level ${level}`;
}

export function TutorRequirementCard({
  set,
  lookup,
  subjectNames,
  accent = "sky",
  actions,
}: {
  set: TutorRequirement;
  lookup?: EducationLookup;
  subjectNames: (id: number) => string;
  accent?: ListingAccent;
  actions?: ReactNode;
}) {
  const classRange =
    set.levelMin === set.levelMax
      ? levelText(lookup, set, set.levelMin)
      : `${levelText(lookup, set, set.levelMin)} to ${levelText(lookup, set, set.levelMax)}`;

  const curriculumNames =
    set.curricula.length === CURRICULUM_COUNT
      ? "All curricula"
      : set.curricula
          .map((c) => curriculumOf(lookup, c)?.label)
          .filter((label): label is string => Boolean(label))
          .join(" · ");

  const needsPlace = !set.teachesOnline && set.zoneIds.length === 0;

  const zoneText =
    set.zoneIds.length > 0
      ? set.zoneIds.length === 1
        ? "1 zone"
        : `${set.zoneIds.length} zones`
      : set.teachesOnline
        ? "Online only"
        : "No zones";

  return (
    <ListingCard
      icon={Layers}
      accent={accent}
      status={
        set.isDefault ? <TonePill tone="info">Default</TonePill> : undefined
      }
      title={
        <h3
          id={`set-title-${set.id}`}
          tabIndex={-1}
          className={cn(listingTitleClass, "outline-none")}
        >
          {set.name}
        </h3>
      }
      body={classRange}
      details={
        <>
          <p>{curriculumNames}</p>
          {set.subjectIds.length === 0 ? (
            <p className="text-[var(--color-semantic-error-text)]">
              No subjects
            </p>
          ) : (
            <p>{set.subjectIds.map(subjectNames).join(", ")}</p>
          )}
          {needsPlace && (
            <p className="font-medium text-[var(--color-semantic-error-text)]">
              {set.isDefault
                ? "Add a zone or turn on online teaching. You can't apply until you do."
                : "Add a zone or turn on online teaching."}
            </p>
          )}
          <p>
            {daysSummary(set)} · {formatTimeRange(set.timeFrom, set.timeTo)}
          </p>
        </>
      }
      meta={zoneText}
      figure={
        set.minSalary !== null ? (
          <>
            {formatTaka(set.minSalary)}
            <span className="font-normal text-[var(--color-text-secondary)]">
              {" / month"}
            </span>
          </>
        ) : undefined
      }
      actions={actions}
    />
  );
}
