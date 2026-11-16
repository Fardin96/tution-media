import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { card } from "@/components/profile/styles";
import {
  combinedLevelLabel,
  curriculumOf,
  type EducationLookup,
} from "@/lib/education";
import {
  daysLabel,
  formatTimeRange,
  type TutorRequirement,
} from "@/lib/tutor-requirements";

const CURRICULUM_COUNT = 7;

const TONE = {
  info: "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
};

function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE.info,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

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
  actions,
}: {
  set: TutorRequirement;
  lookup?: EducationLookup;
  subjectNames: (id: number) => string;
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

  return (
    <article className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            id={`set-title-${set.id}`}
            tabIndex={-1}
            className="font-semibold text-[var(--color-neutral-charcoal)] outline-none"
          >
            {set.name}
          </h3>
          {set.isDefault && <Pill>Default</Pill>}
        </div>

        <div className="mt-2 flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
          <p>{classRange}</p>
          <p>{curriculumNames}</p>
          {set.subjectIds.length === 0 ? (
            <p className="text-[var(--color-semantic-error-text)]">
              No subjects
            </p>
          ) : (
            <p>{set.subjectIds.map(subjectNames).join(", ")}</p>
          )}
          <p>
            {daysLabel(set.availableDays)} ·{" "}
            {formatTimeRange(set.timeFrom, set.timeTo)}
          </p>
          {set.mappedPackageCount > 0 && (
            <p>
              {set.mappedPackageCount === 1
                ? "Used by 1 package"
                : `Used by ${set.mappedPackageCount} packages`}
            </p>
          )}
        </div>
      </div>

      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </article>
  );
}
