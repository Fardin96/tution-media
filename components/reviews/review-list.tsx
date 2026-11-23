"use client";

import { cn } from "@/lib/utils";
import { secondaryButton } from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingLabel } from "@/components/ui/pending-label";
import { formatDay } from "@/components/applications/format";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { StarRating } from "@/components/reviews/star-rating";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  useStudentReviews,
  useTutorReviews,
  type ReviewListPage,
  type ReviewSummary,
} from "@/lib/reviews";

/** The slice of an infinite query the list reads, so both hooks fit. */
type ReviewQuery = {
  data?: { pages: ReviewListPage[] };
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
};

/** Reviews students left for a tutor. `tutorId` is the tutor profile id. */
export function TutorReviewList({ tutorId }: { tutorId: string }) {
  return <ReviewListView query={useTutorReviews(tutorId)} />;
}

/** Reviews tutors left for a student. `studentId` is the student profile id. */
export function StudentReviewList({ studentId }: { studentId: string }) {
  return <ReviewListView query={useStudentReviews(studentId)} />;
}

export function ReviewListView({ query }: { query: ReviewQuery }) {
  if (query.isPending) {
    return (
      <div role="status" className="grid gap-5">
        <span className="sr-only">Loading reviews…</span>
        <div
          aria-hidden="true"
          className="flex flex-wrap items-center gap-x-8 gap-y-4"
        >
          <div className="grid gap-2">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="grid min-w-0 flex-1 basis-56 gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-14 shrink-0" />
                <Skeleton className="h-2 min-w-0 flex-1 rounded-full" />
                <Skeleton className="h-3 w-6 shrink-0" />
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="grid gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="grid gap-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-sm text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t load reviews.
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
  }

  const { pages } = query.data;
  const summary = pages[0]?.summary;
  const reviews = pages.flatMap((page) => page.reviews);

  if (!summary || summary.ratingCount === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No reviews yet.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      <SummaryHeader summary={summary} />
      <ul className="grid gap-3">
        {reviews.map((review, index) => (
          <li
            key={review.id}
            className={cn(
              "grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4",
              enterClass,
            )}
            style={enterStyle(index)}
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                src={review.authorAvatarUrl}
                name={review.authorName}
                size={32}
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 truncate text-sm font-semibold text-[var(--color-neutral-charcoal)]">
                  {review.authorName}
                </p>
                <time
                  dateTime={review.createdAt}
                  className="text-xs text-[var(--color-text-secondary)] tabular-nums"
                >
                  {formatDay(review.createdAt)}
                </time>
              </div>
            </div>
            <StarRating value={review.rating} size="sm" />
            {review.comment && (
              <p className="text-sm break-words whitespace-pre-line text-[var(--color-neutral-charcoal)]">
                {review.comment}
              </p>
            )}
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            aria-busy={query.isFetchingNextPage || undefined}
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            <PendingLabel pending={query.isFetchingNextPage}>
              Show more
            </PendingLabel>
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryHeader({ summary }: { summary: ReviewSummary }) {
  const rows = [5, 4, 3, 2, 1] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="grid gap-1">
        <p className="text-4xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] tabular-nums">
          {summary.ratingAvg.toFixed(1)}
        </p>
        <StarRating value={summary.ratingAvg} />
        <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {summary.ratingCount}{" "}
          {summary.ratingCount === 1 ? "review" : "reviews"}
        </p>
      </div>
      <ul
        aria-label="Reviews by rating"
        className="grid min-w-0 flex-1 basis-56 gap-1.5"
      >
        {rows.map((star) => {
          const count = summary.breakdown[star] ?? 0;
          const share =
            summary.ratingCount > 0 ? (count / summary.ratingCount) * 100 : 0;
          return (
            <li
              key={star}
              className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] tabular-nums"
            >
              <span className="w-14 shrink-0">
                {star} {star === 1 ? "star" : "stars"}
              </span>
              <span
                aria-hidden="true"
                className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]"
              >
                <span
                  className="block h-full rounded-full bg-[var(--color-semantic-warning)]"
                  style={{ width: `${share}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-end">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
