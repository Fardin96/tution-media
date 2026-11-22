"use client";

import { cn } from "@/lib/utils";
import { card } from "@/components/profile/styles";
import { enterClass, enterStyle } from "@/components/motion/enter";
import {
  FilterChips,
  QueryState,
  StatusPill,
} from "@/components/admin/admin-ui";
import { subjectNames } from "@/components/applications/format";
import {
  postedAgo,
  ruleLabel,
  useUnmatchedRequirements,
  type UnmatchedRequirement,
} from "@/lib/admin-matching";
import { curriculumOf, levelLabel, useEducationLookup } from "@/lib/education";
import { useSubjects } from "@/lib/subjects";

export const UNMATCHED_HOURS = [24, 72, 168] as const;

const HOUR_OPTIONS = [
  { value: "24", label: "24 h" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
];

const WINDOW_TEXT: Record<(typeof UNMATCHED_HOURS)[number], string> = {
  24: "24 hours",
  72: "3 days",
  168: "7 days",
};

export function UnmatchedTab({
  hours,
  onHoursChange,
}: {
  hours: number;
  onHoursChange: (hours: number) => void;
}) {
  const query = useUnmatchedRequirements(hours);
  const lookup = useEducationLookup().data;
  const { subjects } = useSubjects();
  const rows = query.data?.requirements ?? [];
  const windowText =
    WINDOW_TEXT[hours as (typeof UNMATCHED_HOURS)[number]] ?? `${hours} hours`;

  return (
    <div className="flex flex-col gap-4">
      <FilterChips
        label="Posted before"
        value={String(hours)}
        options={HOUR_OPTIONS}
        onChange={(value) => onHoursChange(Number(value))}
      />

      <QueryState
        query={query}
        isEmpty={rows.length === 0}
        loadingLabel="Loading tuitions"
        errorText="Couldn't load unmatched tuitions."
        emptyText={`Every open tuition older than ${windowText} has a matching tutor.`}
      >
        <ul className="grid gap-4">
          {rows.map((row, i) => (
            <li key={row.id} className={enterClass} style={enterStyle(i)}>
              <UnmatchedRow
                row={row}
                lookup={lookup}
                subjects={subjects}
                now={new Date()}
              />
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

function UnmatchedRow({
  row,
  lookup,
  subjects,
  now,
}: {
  row: UnmatchedRequirement;
  lookup: ReturnType<typeof useEducationLookup>["data"];
  subjects: { id: number; name: string }[];
  now: Date;
}) {
  const curriculum = curriculumOf(lookup, row.curriculum)?.label;
  const level = levelLabel(lookup, row.curriculum, row.levelCode);
  // Level 0 is a real class, so only a null level is left out.
  const classText = lookup
    ? [curriculum, level].filter(Boolean).join(" · ") || "Class not set"
    : "";
  const details = [subjectNames(row.subjectIds, subjects), row.tuitionType]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={cn(card, "grid gap-3 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {row.studentName}
          </p>
          {classText && (
            <p className="text-sm break-words text-[var(--color-text-secondary)]">
              {classText}
            </p>
          )}
        </div>
        <p className="shrink-0 text-xs text-[var(--color-text-secondary)] tabular-nums">
          {postedAgo(row.createdAt, now)}
        </p>
      </div>

      {details && (
        <p className="text-sm break-words text-[var(--color-text-secondary)]">
          {details}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {row.blockers.length > 0 ? (
          <StatusPill tone="warning">
            Would match without: {row.blockers.map(ruleLabel).join(", ")}
          </StatusPill>
        ) : (
          <StatusPill tone="neutral">Needs more than one change</StatusPill>
        )}
      </div>
    </article>
  );
}
