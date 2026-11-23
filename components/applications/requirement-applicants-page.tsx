"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { GraduationCap, Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { card, secondaryButton } from "@/components/profile/styles";
import { ApplicationActions } from "@/components/applications/application-actions";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { BackLink } from "@/components/ui/back-link";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PageFrame } from "@/components/ui/page-frame";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import { RecommendedTutorsSection } from "@/components/applications/recommended-tutors-section";
import {
  formatDay,
  genderLabel,
  ratingText,
} from "@/components/applications/format";
import {
  applicationQueryOptions,
  useRequirementApplicants,
  useStudentRequirement,
  type Application,
} from "@/lib/applications";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { useIntentPrefetch } from "@/lib/prefetch";
import {
  isPastRequirement,
  postAgainHref,
  requirementQueryOptions,
} from "@/lib/requirements";

function ApplicantCard({ application }: { application: Application }) {
  const { tutor } = application;
  const intent = useIntentPrefetch();
  return (
    <article className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar src={tutor.avatarUrl} name={tutor.name} size={40} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
              <Link
                href={`/tutors/${tutor.id}`}
                className="rounded-sm hover:underline"
              >
                {tutor.name}
              </Link>
            </h2>
            {tutor.instituteName && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-pretty text-[var(--color-text-secondary)]">
                <GraduationCap aria-hidden="true" className="size-4 shrink-0" />
                {tutor.instituteName}
              </p>
            )}
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              {[
                tutor.ratingCount > 0
                  ? `Rated ${ratingText(tutor.ratingAvg, tutor.ratingCount)}`
                  : "No ratings yet",
                genderLabel(tutor.gender),
              ].join(" · ")}
            </p>
          </div>
        </div>
        <StatusPill status={application.status} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {`Applied ${formatDay(application.appliedAt)}`}
        </p>
        <Link
          href={`/dashboard/applications/${application.id}?from=applicants`}
          {...intent(applicationQueryOptions(application.id))}
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          <LinkPendingLabel>View tutor</LinkPendingLabel>
        </Link>
      </div>
      <ApplicationActions
        applicationId={application.id}
        allowedActions={application.allowedActions}
      />
    </article>
  );
}

function ApplicantsSkeleton() {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">Loading applicants…</span>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(card, "flex flex-col gap-4 p-5")}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-52 max-w-full" />
              <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RequirementApplicantsPage({
  requirementId,
}: {
  requirementId: string;
}) {
  const query = useRequirementApplicants(requirementId);
  const { data: requirement } = useStudentRequirement(requirementId);
  const intent = useIntentPrefetch();
  const past = !!requirement && isPastRequirement(requirement.status);

  const applicants = useMemo(
    () => query.data?.pages.flatMap((page) => page.applications) ?? [],
    [query.data],
  );
  const hired = applicants.some(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED",
  );

  let body: ReactNode;
  if (query.isPending) {
    body = <ApplicantsSkeleton />;
  } else if (query.isError) {
    body = (
      <div
        role="alert"
        className={cn(card, "flex flex-col items-start gap-3 p-6")}
      >
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t load the applicants.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-busy={query.isFetching || undefined}
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          <PendingLabel pending={query.isFetching}>Try again</PendingLabel>
        </button>
      </div>
    );
  } else if (applicants.length === 0) {
    body = (
      <div className={cn(card, "flex flex-col items-start gap-3 p-6")}>
        <p className="text-pretty text-[var(--color-text-secondary)]">
          No tutors have applied to this tuition yet.
        </p>
      </div>
    );
  } else {
    body = (
      <ul className="grid gap-4">
        {applicants.map((application, index) => (
          <li
            key={application.id}
            className={enterClass}
            style={enterStyle(index)}
          >
            <ApplicantCard application={application} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        <BackLink href="/dashboard">Dashboard</BackLink>

        <header className="grid gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
                Applicants
              </h1>
              {hired && <TonePill tone="success">Tutor hired</TonePill>}
            </div>
            {past && (
              <Link
                href={postAgainHref(requirementId)}
                {...intent(requirementQueryOptions(requirementId))}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                <LinkPendingLabel>
                  <Repeat2 aria-hidden="true" className="size-4" />
                  Post again
                </LinkPendingLabel>
              </Link>
            )}
          </div>
          <p className="text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
            {hired
              ? "You accepted a tutor for this tuition. Other applicants were declined automatically."
              : "Accept the tutor you want. Decline the rest."}
          </p>
        </header>

        {body}

        {query.hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              aria-busy={query.isFetchingNextPage || undefined}
              className={cn(secondaryButton, "min-h-10 px-5")}
            >
              <PendingLabel pending={query.isFetchingNextPage}>
                Load more
              </PendingLabel>
            </button>
          </div>
        )}

        <RecommendedTutorsSection requirementId={requirementId} />
      </div>
    </PageFrame>
  );
}
