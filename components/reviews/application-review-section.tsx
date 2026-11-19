"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import { Section } from "@/components/applications/detail-sections";
import { TonePill } from "@/components/applications/status-pill";
import { formatDay } from "@/components/applications/format";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { StarRating } from "@/components/reviews/star-rating";
import type { ApplicationDetail } from "@/lib/applications";
import { useMyReview } from "@/lib/reviews";

/** Applications whose tuition has started, so each side can review the other. */
export function canReview(status: ApplicationDetail["status"]): boolean {
  return status === "CONFIRMED" || status === "COMPLETED";
}

/** The viewer's own review of the other side of this application. Renders nothing before the tuition is confirmed. */
export function ApplicationReviewSection({
  application,
  viewerRole,
}: {
  application: ApplicationDetail;
  viewerRole: "STUDENT" | "TUTOR";
}) {
  const eligible = canReview(application.status);
  const query = useMyReview(application.id, eligible);
  const [open, setOpen] = useState(false);

  if (!eligible) return null;

  const name =
    viewerRole === "TUTOR" ? application.student.name : application.tutor.name;
  const review = query.data;

  let body: React.ReactNode;
  if (query.isPending) {
    body = (
      <div
        role="status"
        className="h-16 animate-pulse rounded-[16px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none"
      >
        <span className="sr-only">Loading your review</span>
      </div>
    );
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t load your review.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          Try again
        </button>
      </div>
    );
  } else if (!review) {
    body = (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          Tell others how it went with {name}.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(primaryButton, "min-h-10 px-4")}
        >
          Rate {name}
        </button>
      </div>
    );
  } else {
    const hidden = review.status === "HIDDEN";
    body = (
      <div className="grid justify-items-start gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StarRating value={review.rating} />
          {hidden && <TonePill tone="neutral">Hidden by an admin</TonePill>}
        </div>
        {review.comment && (
          <p className="text-sm break-words whitespace-pre-line text-[var(--color-neutral-charcoal)]">
            {review.comment}
          </p>
        )}
        {hidden ? (
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            Other people can&apos;t see this review, and you can&apos;t edit it.
          </p>
        ) : (
          review.canEdit && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                Edit
              </button>
              <p className="text-sm text-[var(--color-text-secondary)]">
                You can edit until {formatDay(review.editableUntil)}
              </p>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <>
      <Section title="Your review">{body}</Section>
      {!query.isPending && !query.isError && (
        <ReviewDialog
          applicationId={application.id}
          subjectName={name}
          existing={review}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
