import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import { useEducationLookup } from "@/lib/education";
import { useAreas } from "@/lib/areas";
import { useSubjects } from "@/lib/subjects";
import { applicationQueryOptions, type Application } from "@/lib/applications";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useIntentPrefetch } from "@/lib/prefetch";
import { ApplicationActions } from "@/components/applications/application-actions";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import {
  areaText,
  durationText,
  formatDay,
  headingText,
  levelText,
  moneyText,
  ratingText,
  scheduleText,
  showsClosedNote,
  subjectNames,
} from "@/components/applications/format";

export function ApplicationCard({
  application,
  role,
}: {
  application: Application;
  role: "TUTOR" | "STUDENT";
}) {
  const lookup = useEducationLookup();
  const intent = useIntentPrefetch();
  const { subjects } = useSubjects();
  const { areas } = useAreas();
  const { target } = application;
  const isTutor = role === "TUTOR";
  const counterpart = isTutor ? application.student : application.tutor;
  const counterpartName = counterpart.name;
  const badge = counterpart.verifiedBadge ? (
    <VerifiedBadge size={16} className="ms-1.5" />
  ) : null;

  const heading = headingText(target, counterpartName);
  const details = [
    subjectNames(target.subjectIds, subjects),
    levelText(lookup.data, target),
    areaText(target, areas),
  ].filter(Boolean);
  const money = [
    moneyText(target),
    durationText(target),
    scheduleText(target),
  ].filter(Boolean);

  return (
    <article className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            src={counterpart.avatarUrl}
            name={counterpartName}
            size={40}
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
              {heading}
              {heading === counterpartName && badge}
            </h2>
            {heading !== counterpartName && (
              <p className="mt-0.5 text-sm text-pretty text-[var(--color-text-secondary)]">
                {counterpartName}
                {badge}
              </p>
            )}
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
          {...intent(applicationQueryOptions(application.id))}
          className={cn(
            "inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--color-primary-core)] transition-[background-color] duration-150 ease-out hover:bg-[var(--color-secondary-sky)] motion-reduce:transition-none",
            focusRing,
          )}
        >
          <LinkPendingLabel>
            View
            <ChevronRight
              aria-hidden="true"
              className="size-4 rtl:-scale-x-100"
            />
          </LinkPendingLabel>
        </Link>
      </div>

      <ApplicationActions
        applicationId={application.id}
        allowedActions={application.allowedActions}
      />
    </article>
  );
}
