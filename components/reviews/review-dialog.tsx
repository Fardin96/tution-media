"use client";

import { useId, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { secondaryButton } from "@/components/profile/styles";
import {
  AdminDialog,
  DialogActions,
  Field,
  PendingButton,
  textareaClass,
} from "@/components/admin/admin-ui";
import { StarRatingInput } from "@/components/reviews/star-rating-input";
import { errorCodeMessage, mapServerIssuesToFields } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import {
  REVIEW_COMMENT_MAX,
  useCreateReview,
  useUpdateReview,
  validateReview,
  type MyReview,
  type ReviewErrors,
} from "@/lib/reviews";
import { toastError, toastSuccess } from "@/lib/toast";

/**
 * Writes a review, or edits one when `existing` is passed. A 409 stays in the dialog next to
 * the form (not allowed yet, hidden, past the edit window), except REVIEW_EXISTS on create: the
 * review is already there, so the dialog closes and the section shows it.
 */
export function ReviewDialog({
  applicationId,
  subjectName,
  existing,
  open,
  onOpenChange,
}: {
  applicationId: string;
  /** The person being reviewed. */
  subjectName: string;
  existing?: MyReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateReview();
  const update = useUpdateReview(existing?.id ?? "");
  const [serverError, setServerError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<ReviewErrors>({});
  const editing = Boolean(existing);
  const pending = create.isPending || update.isPending;

  function finish(message: string) {
    onOpenChange(false);
    toastSuccess(message);
  }

  function fail(err: unknown) {
    // Someone already reviewed this pair (another tab, or another application). Show the review instead.
    if (
      !editing &&
      err instanceof ApiError &&
      err.status === 409 &&
      err.code === "REVIEW_EXISTS"
    ) {
      onOpenChange(false);
      toastSuccess(
        `You already reviewed ${subjectName}. Your review is below.`,
      );
      return;
    }
    if (err instanceof ApiError && err.status === 409) {
      setServerError(errorCodeMessage(err) ?? err.message);
      return;
    }
    if (err instanceof ApiError && err.status === 400 && err.issues?.length) {
      const mapped = mapServerIssuesToFields<"rating" | "comment">(err.issues);
      if (mapped.rating || mapped.comment) {
        setFieldErrors(mapped);
        return;
      }
    }
    toastError(
      editing ? "Couldn't update your review." : "Couldn't post your review.",
      err,
    );
  }

  function submit(rating: number, comment: string) {
    setServerError(undefined);
    setFieldErrors({});
    const text = comment.trim();
    if (existing) {
      const body: { rating?: number; comment?: string | null } = {};
      if (rating !== existing.rating) body.rating = rating;
      if (text !== (existing.comment ?? "")) body.comment = text || null;
      if (Object.keys(body).length === 0) {
        onOpenChange(false);
        return;
      }
      update.mutate(body, {
        onSuccess: () => finish("Review updated"),
        onError: fail,
      });
      return;
    }
    create.mutate(
      { applicationId, rating, ...(text ? { comment: text } : {}) },
      { onSuccess: () => finish("Review posted"), onError: fail },
    );
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setServerError(undefined);
          setFieldErrors({});
        }
        onOpenChange(next);
      }}
      title={editing ? "Edit your review" : `Rate ${subjectName}`}
      description="Your name shows with your review. Be specific and polite."
      busy={pending}
    >
      <ReviewForm
        initialRating={existing?.rating ?? 0}
        initialComment={existing?.comment ?? ""}
        editing={editing}
        pending={pending}
        serverError={serverError}
        fieldErrors={fieldErrors}
        onCancel={() => onOpenChange(false)}
        onSubmit={submit}
      />
    </AdminDialog>
  );
}

/** Mounted only while the dialog is open, so each opening starts from the saved review. */
function ReviewForm({
  initialRating,
  initialComment,
  editing,
  pending,
  serverError,
  fieldErrors,
  onCancel,
  onSubmit,
}: {
  initialRating: number;
  initialComment: string;
  editing: boolean;
  pending: boolean;
  serverError?: string;
  fieldErrors: ReviewErrors;
  onCancel: () => void;
  onSubmit: (rating: number, comment: string) => void;
}) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [attempted, setAttempted] = useState(false);
  const ratingId = useId();
  const ratingErrorId = `${ratingId}-error`;

  const checked = validateReview({ rating, comment });
  const ratingError = attempted ? checked.rating : fieldErrors.rating;
  const commentError = attempted ? checked.comment : fieldErrors.comment;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setAttempted(true);
    if (checked.rating || checked.comment) return;
    onSubmit(rating, comment);
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <div className="grid gap-1.5">
        <p
          id={`${ratingId}-label`}
          className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
        >
          Your rating
        </p>
        <StarRatingInput
          name={`rating-${ratingId}`}
          value={rating}
          onChange={setRating}
          label="Your rating"
          describedBy={ratingError ? ratingErrorId : undefined}
          invalid={Boolean(ratingError)}
          disabled={pending}
        />
        {ratingError && (
          <p
            id={ratingErrorId}
            role="alert"
            className="text-sm text-pretty text-[var(--color-semantic-error-text)]"
          >
            {ratingError}
          </p>
        )}
      </div>

      <Field
        label="Comment (optional)"
        error={commentError}
        hint="What went well, or what could be better?"
      >
        {({ id, describedBy, invalid }) => (
          <div className="grid gap-1.5">
            <textarea
              id={id}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              disabled={pending}
              rows={4}
              className={textareaClass}
            />
            <p
              className={cn(
                "text-end text-xs tabular-nums",
                comment.length > REVIEW_COMMENT_MAX
                  ? "text-[var(--color-semantic-error-text)]"
                  : "text-[var(--color-text-secondary)]",
              )}
            >
              {comment.length}/{REVIEW_COMMENT_MAX}
            </p>
          </div>
        )}
      </Field>

      {serverError && (
        <p
          role="alert"
          className="text-sm text-pretty text-[var(--color-semantic-error-text)]"
        >
          {serverError}
        </p>
      )}

      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={cn(secondaryButton, "min-h-11")}
        >
          Cancel
        </button>
        <PendingButton pending={pending}>
          {editing ? "Save changes" : "Post review"}
        </PendingButton>
      </DialogActions>
    </form>
  );
}
