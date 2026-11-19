"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { secondaryButton, primaryButton } from "@/components/profile/styles";
import {
  DialogActions,
  Field,
  textareaClass,
} from "@/components/admin/admin-ui";
import { validateReviewNote } from "@/lib/admin-moderation";

export type ReviewSubmit = { note: string | undefined; noteVisible: boolean };

/**
 * The form inside an AdminDialog for every upload decision: a note, whether the user may see it,
 * and any extra controls the caller adds (scope switches, "also remove verified status").
 * The caller owns the dialog and the request; this owns the note and its validation.
 */
export function ReviewNoteForm({
  noteLabel,
  noteRequired,
  submitLabel,
  saving,
  danger = false,
  extra,
  extraError,
  onCancel,
  onSubmit,
}: {
  noteLabel: string;
  noteRequired: boolean;
  submitLabel: string;
  saving: boolean;
  /** Destructive actions (reject, remove, block) get the red label. */
  danger?: boolean;
  /** Extra controls shown above the note. */
  extra?: ReactNode;
  /** An error for the extra controls; blocks submit while set. */
  extraError?: string;
  onCancel: () => void;
  onSubmit: (value: ReviewSubmit) => void;
}) {
  const [note, setNote] = useState("");
  const [noteVisible, setNoteVisible] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const noteError = validateReviewNote(note, noteRequired);
  const shownNoteError = submitted ? noteError : undefined;

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (noteError || extraError) return;
    const trimmed = note.trim();
    onSubmit({ note: trimmed === "" ? undefined : trimmed, noteVisible });
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid min-w-0 gap-5">
      {extra && (
        <div className="grid min-w-0 gap-3">
          {extra}
          {submitted && extraError && (
            <p
              role="alert"
              className="text-sm text-[var(--color-semantic-error-text)]"
            >
              {extraError}
            </p>
          )}
        </div>
      )}

      <div className="grid min-w-0 gap-3">
        <Field
          label={noteRequired ? noteLabel : `${noteLabel} (optional)`}
          hint="3 to 500 characters."
          error={shownNoteError}
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={textareaClass}
            />
          )}
        </Field>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={noteVisible}
            onChange={(e) => setNoteVisible(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary-core)]"
          />
          <span className="grid gap-0.5">
            <span className="font-semibold text-[var(--color-neutral-charcoal)]">
              Show this note to the user
            </span>
            <span className="text-[var(--color-text-secondary)]">
              {noteVisible
                ? "They see it on their dashboard and in their alerts."
                : "Only admins see it. The user gets a general message."}
            </span>
          </span>
        </label>
      </div>

      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className={cn(
            danger ? secondaryButton : primaryButton,
            "min-h-11 sm:min-w-28",
            danger && "text-[var(--color-semantic-error-text)]",
          )}
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </DialogActions>
    </form>
  );
}
