"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import { formatDay } from "@/components/applications/format";
import { MatchReasons } from "@/components/browse/match-reasons";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  applicationQueryOptions,
  type ApplicationStatus,
} from "@/lib/applications";
import type { BrowseRequirement } from "@/lib/browse";
import { formatDistanceKm } from "@/lib/browse";
import { formatTaka, formatTime } from "@/lib/requirements";
import { daysLabel, daysPerWeekLabel, EVERY_DAY } from "@/lib/days";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { useIntentPrefetch } from "@/lib/prefetch";

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

export type TuitionApplyState =
  | { kind: "closed" }
  | { kind: "applied"; applicationId: string; status: ApplicationStatus }
  | {
      kind: "open";
      applying: boolean;
      /** Another row's apply is running (the mutation is shared), so this Apply waits. */
      busy?: boolean;
      /** Why Apply is unavailable (profile incomplete). Null when Apply is allowed. */
      blockedReason: string | null;
      onApply: () => void;
    };

export interface TuitionCardProps {
  tuition: BrowseRequirement;
  subjectNames: string[];
  /** Resolved from the education lookup by the page. */
  curriculumLabel: string | null;
  levelLabel: string;
  areaName: string | null;
  apply: TuitionApplyState;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
        {children}
      </dd>
    </div>
  );
}

export function TuitionCard({
  tuition,
  subjectNames,
  curriculumLabel,
  levelLabel,
  areaName,
  apply,
}: TuitionCardProps) {
  const intent = useIntentPrefetch();
  const distance = formatDistanceKm(tuition.distanceKm);
  const time = formatTime(tuition.timeOfDay);
  const dayParts = [
    tuition.daysPerWeek === null ? null : daysPerWeekLabel(tuition.daysPerWeek),
    tuition.availableDays !== EVERY_DAY
      ? daysLabel(tuition.availableDays)
      : null,
  ].filter((part): part is string => part !== null);
  const days = dayParts.length > 0 ? dayParts.join(" · ") : null;
  const students =
    tuition.studentCount === null
      ? null
      : `${tuition.studentCount} ${plural(tuition.studentCount, "student", "students")}`;
  const genderPref =
    tuition.tutorGenderPref === "FEMALE"
      ? "Prefers a female tutor"
      : tuition.tutorGenderPref === "MALE"
        ? "Prefers a male tutor"
        : null;
  const subjectsText = subjectNames.join(" · ") || "Subject not listed";
  const applyId = `tuition-${tuition.id}-apply-reason`;

  return (
    <article className={cn(card, "flex flex-col gap-5 p-5 sm:p-6")}>
      <div className="grid gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            {[curriculumLabel, levelLabel].filter(Boolean).join(" · ")}
          </p>
          {distance && (
            <p className="text-xs font-medium text-[var(--color-primary-deep)] tabular-nums">
              {`${distance} away`}
            </p>
          )}
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)]">
          {subjectsText}
        </h2>
        {tuition.match && (
          <MatchReasons reasons={tuition.match.reasons} className="mt-2" />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Fact label="Area">{areaName ?? "Any area"}</Fact>
        <Fact label="Salary">
          {tuition.salary === null
            ? "Not listed"
            : `${formatTaka(tuition.salary)} a month`}
        </Fact>
        {days && <Fact label="Days">{days}</Fact>}
        {time && <Fact label="Time">{time}</Fact>}
        {students && <Fact label="Students">{students}</Fact>}
      </dl>

      {genderPref && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {genderPref}
        </p>
      )}

      <p className="text-xs text-[var(--color-text-secondary)]">
        {[
          `Posted ${formatDay(tuition.createdAt)}`,
          tuition.hireByDate
            ? `Hire by ${formatDay(tuition.hireByDate)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {tuition.invitedAt && <TonePill tone="info">Invited</TonePill>}
          {apply.kind === "closed" && (
            <TonePill tone="neutral">Application closed</TonePill>
          )}

          {apply.kind === "applied" && (
            <>
              <StatusPill status={apply.status} />
              <Link
                href={`/dashboard/applications/${apply.applicationId}`}
                {...intent(applicationQueryOptions(apply.applicationId))}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                <LinkPendingLabel>
                  View
                  <span className="sr-only"> application</span>
                </LinkPendingLabel>
              </Link>
            </>
          )}
        </div>

        {apply.kind === "open" && (
          <div className="grid w-full gap-2 sm:w-auto sm:justify-items-end">
            <button
              type="button"
              onClick={apply.onApply}
              disabled={
                apply.applying ||
                apply.busy === true ||
                apply.blockedReason !== null
              }
              aria-busy={apply.applying || undefined}
              aria-describedby={apply.blockedReason ? applyId : undefined}
              className={cn(primaryButton, "w-full sm:w-auto")}
            >
              <PendingLabel pending={apply.applying}>
                Apply
                <span className="sr-only"> for {subjectsText}</span>
              </PendingLabel>
            </button>
            {apply.blockedReason && (
              <p
                id={applyId}
                className="text-sm text-[var(--color-text-secondary)]"
              >
                {apply.blockedReason}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
