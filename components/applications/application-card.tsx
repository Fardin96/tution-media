import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import { useEducationLookup } from "@/lib/education";
import type { Application } from "@/lib/applications";
import { ApplicationActions } from "@/components/applications/application-actions";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import {
  formatDay,
  levelText,
  ratingText,
  salaryText,
  scheduleText,
  showsClosedNote,
  subjectNames,
  areaName,
} from "@/components/applications/format";

export function ApplicationCard({
  application,
  role,
}: {
  application: Application;
  role: "TUTOR" | "STUDENT";
}) {
  const lookup = useEducationLookup();
  const { target } = application;
  const isTutor = role === "TUTOR";
  const counterpartName = isTutor
    ? application.student.name
    : application.tutor.name;

  const details = [
    subjectNames(target.subjectIds),
    levelText(lookup.data, target),
    areaName(target.areaId),
  ].filter(Boolean);
  const money = [salaryText(target.salary), scheduleText(target)].filter(
    Boolean,
  );

  return (
    <article className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
            {counterpartName}
          </h2>
          {!isTutor && application.tutor.ratingCount > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--color-text-secondary)] tabular-nums">
              <Star
                aria-hidden="true"
                className="size-4 fill-current text-[var(--color-semantic-warning-text)]"
              />
              {ratingText(
                application.tutor.ratingAvg,
                application.tutor.ratingCount,
              )}
            </p>
          )}
        </div>
        <StatusPill status={application.status} />
      </div>

      <div className="grid gap-1 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4 text-sm text-[var(--color-neutral-charcoal)]">
        <p className="font-medium text-pretty">{details.join(" · ")}</p>
        {money.length > 0 && (
          <p className="text-[var(--color-text-secondary)] tabular-nums">
            {money.join(" · ")}
          </p>
        )}
      </div>

      {showsClosedNote(application) && (
        <TonePill tone="neutral" className="self-start">
          Application closed
        </TonePill>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {`Applied ${formatDay(application.appliedAt)}`}
        </p>
        <Link
          href={`/dashboard/applications/${application.id}`}
          className={cn(
            "inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--color-primary-core)] transition-[background-color] duration-150 ease-out hover:bg-[var(--color-secondary-sky)] motion-reduce:transition-none",
            focusRing,
          )}
        >
          View
          <ChevronRight
            aria-hidden="true"
            className="size-4 rtl:-scale-x-100"
          />
        </Link>
      </div>

      <ApplicationActions
        applicationId={application.id}
        allowedActions={application.allowedActions}
      />
    </article>
  );
}
