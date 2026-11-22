"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { StatusPill } from "@/components/applications/status-pill";
import { MatchReasons } from "@/components/browse/match-reasons";
import {
  EmptyCard,
  ErrorBlock,
  RatingInline,
  TutorInitial,
} from "@/components/browse/browse-ui";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { dedupeBy } from "@/lib/browse";
import {
  useInviteTutor,
  useRecommendedTutors,
  useStudentRequirement,
  type RecommendedSuggestion,
  type RecommendedTutor,
} from "@/lib/applications";
import type { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

function suggestionText(suggestion: RecommendedSuggestion): string {
  const n = suggestion.extraTutors;
  const tutors = `${n} more ${n === 1 ? "tutor" : "tutors"}`;
  return suggestion.code === "ALLOW_ONLINE"
    ? `Allow online tuition: ${tutors}`
    : `Accept any tutor gender: ${tutors}`;
}

function Suggestions({
  requirementId,
  suggestions,
}: {
  requirementId: string;
  suggestions: RecommendedSuggestion[];
}) {
  return (
    <ul className="grid gap-2">
      {suggestions.map((suggestion) => (
        <li key={suggestion.code}>
          <Link
            href={`/dashboard/requirements/${requirementId}/edit`}
            className={cn(
              "rounded-sm text-sm font-medium text-[var(--color-primary-core)] underline-offset-4 hover:underline",
              focusRing,
            )}
          >
            {suggestionText(suggestion)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecommendedTutorRow({
  row,
  inviting,
  inviteBusy,
  onInvite,
}: {
  row: RecommendedTutor;
  /** This row's invite is the one running. */
  inviting: boolean;
  /** Any invite is running: the invite mutation is shared, so the other rows wait. */
  inviteBusy: boolean;
  onInvite: () => void;
}) {
  const { tutor, reasons, application, invitedAt } = row;
  const institute = tutor.instituteName?.trim();

  let action: ReactNode;
  if (application) {
    action = <StatusPill status={application.status} />;
  } else if (invitedAt) {
    action = (
      <button
        type="button"
        disabled
        className={cn(secondaryButton, "min-h-10 px-4")}
      >
        Invited
        <span className="sr-only"> {tutor.name}</span>
      </button>
    );
  } else {
    action = (
      <button
        type="button"
        onClick={onInvite}
        disabled={inviteBusy}
        aria-busy={inviting || undefined}
        className={cn(primaryButton, "min-h-10 px-4")}
      >
        <PendingLabel pending={inviting}>
          Invite to apply
          <span className="sr-only"> {tutor.name}</span>
        </PendingLabel>
      </button>
    );
  }

  return (
    <article className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="flex items-start gap-3">
        <TutorInitial name={tutor.name} />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
              {tutor.name}
            </h3>
            <RatingInline
              ratingAvg={tutor.ratingAvg}
              ratingCount={tutor.ratingCount}
            />
          </div>
          {institute && (
            <p className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <GraduationCap
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span className="min-w-0 text-pretty">{institute}</span>
            </p>
          )}
        </div>
      </div>

      {tutor.subjects.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Subjects">
          {tutor.subjects.map((subject) => (
            <li
              key={subject.id}
              className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {subject.name}
            </li>
          ))}
        </ul>
      )}

      <MatchReasons reasons={reasons} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/tutors/${tutor.id}`}
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          <LinkPendingLabel>
            View profile
            <span className="sr-only"> for {tutor.name}</span>
          </LinkPendingLabel>
        </Link>
        {action}
      </div>
    </article>
  );
}

/**
 * Tutors whose best set fits this open tuition, with an invite action. Hidden until the
 * requirement loads as OPEN, and once it stops being open.
 */
export function RecommendedTutorsSection({
  requirementId,
}: {
  requirementId: string;
}) {
  const headingId = useId();
  const requirement = useStudentRequirement(requirementId);
  const isOpen = requirement.data?.status === "OPEN";
  const list = useRecommendedTutors(requirementId, isOpen);
  const invite = useInviteTutor(requirementId);

  if (!isOpen) return null;
  const listError = list.error as ApiError | null;
  if (listError?.code === "LISTING_NOT_OPEN") return null;

  const tutors = dedupeBy(
    list.data?.pages.flatMap((page) => page.tutors) ?? [],
    (row) => row.tutor.id,
  );
  const suggestions = list.data?.pages[0]?.suggestions ?? [];

  let body: ReactNode;
  if (list.isPending) {
    body = (
      <div role="status" className="grid gap-4">
        <span className="sr-only">Loading recommended tutors…</span>
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(card, "flex flex-col gap-4 p-5")}
          >
            <div className="flex items-start gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="grid min-w-0 flex-1 gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-52 max-w-full" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-44 max-w-full" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-36 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (list.isError) {
    body = (
      <ErrorBlock
        message="Couldn't load recommended tutors."
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else if (tutors.length === 0) {
    body = (
      <EmptyCard title="No tutors match this tuition yet.">
        <div className="grid w-full gap-3">
          {suggestions.length > 0 && (
            <Suggestions
              requirementId={requirementId}
              suggestions={suggestions}
            />
          )}
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            New tutors show up here when they join.
          </p>
        </div>
      </EmptyCard>
    );
  } else {
    body = (
      <div className="grid gap-4">
        <ul className="grid gap-4">
          {tutors.map((row, index) => (
            <li
              key={row.tutor.id}
              className={enterClass}
              style={enterStyle(index)}
            >
              <RecommendedTutorRow
                row={row}
                inviting={invite.isPending && invite.variables === row.tutor.id}
                inviteBusy={invite.isPending}
                onInvite={() =>
                  invite.mutate(row.tutor.id, {
                    onSuccess: () =>
                      toastSuccess(`Invite sent to ${row.tutor.name}.`),
                    onError: (err) =>
                      toastError("Couldn't send the invite.", err),
                  })
                }
              />
            </li>
          ))}
        </ul>
        {suggestions.length > 0 && (
          <Suggestions
            requirementId={requirementId}
            suggestions={suggestions}
          />
        )}
        {list.hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
              aria-busy={list.isFetchingNextPage || undefined}
              className={cn(secondaryButton, "min-h-10 px-5")}
            >
              <PendingLabel pending={list.isFetchingNextPage}>
                Show more tutors
              </PendingLabel>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <header className="grid gap-1">
        <h2
          id={headingId}
          className="text-lg font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-xl"
        >
          Recommended tutors
        </h2>
        <p className="text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
          Tutors whose classes, subjects and area fit this tuition.
        </p>
      </header>
      {body}
    </section>
  );
}
