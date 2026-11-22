"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { StarRating } from "@/components/reviews/star-rating";
import { cn } from "@/lib/utils";
import { card, secondaryButton } from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
} from "@/components/admin/admin-ui";
import {
  NoteForm,
  Parties,
  failureText,
  isConflict,
} from "@/components/admin/case-parts";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { formatDateTime } from "@/lib/admin";
import {
  REVIEW_DIRECTION_LABEL,
  REVIEW_NOTE_MAX,
  REVIEW_STATUS_META,
  reviewParties,
  useAdminReviews,
  useModerateReview,
  validateReviewNote,
  type AdminReview,
  type AdminReviewFilters,
  type ReviewDirection,
} from "@/lib/admin-reviews";

type View = "visible" | "hidden" | "all";

const VIEWS: { value: View; label: string; status?: "VISIBLE" | "HIDDEN" }[] = [
  { value: "visible", label: "Visible", status: "VISIBLE" },
  { value: "hidden", label: "Hidden", status: "HIDDEN" },
  { value: "all", label: "All" },
];

type RatingView = "any" | "1" | "2" | "3" | "4" | "5";

const RATINGS: { value: RatingView; label: string }[] = [
  { value: "any", label: "Any rating" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
];

type DirectionView = ReviewDirection | "any";

const DIRECTIONS: { value: DirectionView; label: string }[] = [
  { value: "any", label: "Any direction" },
  { value: "STUDENT_TO_TUTOR", label: "Student to tutor" },
  { value: "TUTOR_TO_STUDENT", label: "Tutor to student" },
];

const EMPTY_TEXT: Record<View, string> = {
  visible: "No visible reviews match.",
  hidden: "No hidden reviews.",
  all: "No reviews match.",
};

export function AdminReviewsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawView = searchParams.get("view") ?? "visible";
  const view: View = VIEWS.some((v) => v.value === rawView)
    ? (rawView as View)
    : "visible";
  const rawRating = searchParams.get("rating") ?? "any";
  const rating: RatingView = RATINGS.some((r) => r.value === rawRating)
    ? (rawRating as RatingView)
    : "any";
  const rawDirection = searchParams.get("direction") ?? "any";
  const direction: DirectionView = DIRECTIONS.some(
    (d) => d.value === rawDirection,
  )
    ? (rawDirection as DirectionView)
    : "any";

  const filters: AdminReviewFilters = {
    status: VIEWS.find((v) => v.value === view)?.status,
    rating: rating === "any" ? undefined : Number(rating),
    direction: direction === "any" ? undefined : direction,
  };
  const query = useAdminReviews(filters);
  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? [];

  const moderate = useModerateReview();
  const [target, setTarget] = useState<AdminReview | null>(null);

  // Filters live in the URL. Defaults drop their param so the bare path stays clean.
  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function closeDialog() {
    if (!moderate.isPending) setTarget(null);
  }

  function submit(note: string) {
    if (!target) return;
    const status = target.status === "VISIBLE" ? "HIDDEN" : "VISIBLE";
    moderate.mutate(
      { id: target.id, status, note },
      {
        onSuccess: () => {
          toast.success(
            status === "HIDDEN" ? "Review hidden" : "Review visible again",
          );
          setTarget(null);
        },
        onError: (err) => {
          toast.error(
            failureText(
              err,
              status === "HIDDEN"
                ? "Couldn't hide the review."
                : "Couldn't restore the review.",
            ),
          );
          if (isConflict(err)) setTarget(null);
        },
      },
    );
  }

  const hiding = target?.status === "VISIBLE";

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Reviews"
      description="Ratings and comments from students and tutors, newest first. A hidden review leaves public profiles and the average."
    >
      <div className="grid gap-3">
        <FilterChips
          label="Review view"
          value={view}
          options={VIEWS}
          onChange={(next) =>
            setParam("view", next === "visible" ? null : next)
          }
        />
        <FilterChips
          label="Rating"
          value={rating}
          options={RATINGS}
          onChange={(next) => setParam("rating", next === "any" ? null : next)}
        />
        <FilterChips
          label="Direction"
          value={direction}
          options={DIRECTIONS}
          onChange={(next) =>
            setParam("direction", next === "any" ? null : next)
          }
        />
      </div>

      <QueryState
        query={query}
        isEmpty={reviews.length === 0}
        loadingLabel="Loading reviews"
        errorText="Couldn't load reviews."
        emptyText={EMPTY_TEXT[view]}
      >
        <ul className="grid gap-4">
          {reviews.map((review, index) => (
            <li
              key={review.id}
              className={enterClass}
              style={enterStyle(index)}
            >
              <ReviewRow review={review} onModerate={() => setTarget(review)} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>

      <AdminDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        busy={moderate.isPending}
        title={hiding ? "Hide this review?" : "Show this review again?"}
        description={
          hiding
            ? "It leaves public profiles and the rating average. The author can't edit it while it's hidden."
            : "It goes back on the profile and counts in the rating average."
        }
      >
        {target && (
          <NoteForm
            key={target.id}
            label="Note"
            submitLabel={hiding ? "Hide review" : "Show review"}
            saving={moderate.isPending}
            onCancel={closeDialog}
            onSubmit={submit}
            max={REVIEW_NOTE_MAX}
            validate={validateReviewNote}
          />
        )}
      </AdminDialog>
    </AdminPage>
  );
}

function ReviewRow({
  review,
  onModerate,
}: {
  review: AdminReview;
  onModerate: () => void;
}) {
  const { author, subject } = reviewParties(review);
  const meta = REVIEW_STATUS_META[review.status];
  const hidden = review.status === "HIDDEN";
  return (
    <article className={cn(card, "grid gap-3 p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StarRating value={review.rating} size="sm" className="shrink-0" />
          {hidden && <StatusPill tone={meta.tone}>{meta.label}</StatusPill>}
        </div>
        <button
          type="button"
          onClick={onModerate}
          aria-label={`${hidden ? "Show" : "Hide"} review by ${author}`}
          className={cn(secondaryButton, "min-h-10")}
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      <p
        className={cn(
          "text-sm break-words whitespace-pre-line",
          review.comment
            ? "text-[var(--color-neutral-charcoal)]"
            : "text-[var(--color-text-secondary)]",
        )}
      >
        {review.comment ?? "No comment."}
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
        <span className="font-semibold text-[var(--color-neutral-charcoal)]">
          <Parties from={author} to={subject} word="reviewed" />
        </span>
        <span>{REVIEW_DIRECTION_LABEL[review.direction]}</span>
        <time dateTime={review.createdAt}>
          {formatDateTime(review.createdAt)}
        </time>
      </p>
    </article>
  );
}
