"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  DialogActions,
  Field,
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
  textareaClass,
} from "@/components/admin/admin-ui";
import { formatDateTime } from "@/lib/admin";
import {
  fileTypeText,
  useAdminVerifications,
  useDecideVerification,
  validateDecisionNote,
  VERIFICATION_STATUS_META,
  type DecideVerificationInput,
  type VerificationKind,
  type VerificationRow,
  type VerificationStatus,
} from "@/lib/admin-verifications";
import { openFile, formatBytes } from "@/lib/files";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

const PATH = "/dashboard/admin/verifications";

const KIND_OPTIONS: { value: VerificationKind; label: string }[] = [
  { value: "tutors", label: "Tutors" },
  { value: "students", label: "Students" },
];

const STATUS_OPTIONS: { value: VerificationStatus; label: string }[] = [
  { value: "PENDING", label: "Waiting for review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const EMPTY_COPY: Record<VerificationStatus, string> = {
  PENDING: "Nothing waiting. New ID submissions show up here.",
  APPROVED: "No approved IDs yet.",
  REJECTED: "No rejected IDs.",
};

function parseKind(value: string | null): VerificationKind {
  return value === "students" ? "students" : "tutors";
}

function parseStatus(value: string | null): VerificationStatus {
  return (
    STATUS_OPTIONS.find((option) => option.value === value)?.value ?? "PENDING"
  );
}

/* ───────── Review state and dialogs (shared with the videos page) ───────── */

export type VerificationReviewTarget = {
  kind: VerificationKind;
  decideId: string;
  name: string;
  action: "APPROVE" | "REJECT";
};

/**
 * Approve or reject one ID. The dialog stays mounted through its close animation,
 * so `target` keeps its last value and only `open` goes false.
 */
export function useVerificationReview() {
  const [target, setTarget] = useState<VerificationReviewTarget | null>(null);
  const [open, setOpen] = useState(false);
  const decide = useDecideVerification();

  function start(row: VerificationRow, action: "APPROVE" | "REJECT") {
    setTarget({
      kind: row.kind,
      decideId: row.decideId,
      name: row.name,
      action,
    });
    setOpen(true);
  }

  function close() {
    if (!decide.isPending) setOpen(false);
  }

  function confirm(note?: string) {
    if (!target) return;
    const body: DecideVerificationInput =
      target.action === "APPROVE"
        ? { decision: "APPROVE" }
        : { decision: "REJECT", note };
    decide.mutate(
      { kind: target.kind, id: target.decideId, body },
      {
        onSuccess: () => {
          toastSuccess(target.action === "APPROVE" ? "Approved" : "Rejected");
          setOpen(false);
        },
        onError: (err) => {
          toastError("Couldn't save the decision.", err);
          // 409: the submission was already decided. The list refetches on settle.
          if (err instanceof ApiError && err.status === 409) setOpen(false);
        },
      },
    );
  }

  return {
    target,
    open,
    start,
    close,
    confirm,
    saving: decide.isPending,
  };
}

export type VerificationReviewState = ReturnType<typeof useVerificationReview>;

function VerificationReviewDialog({
  review,
}: {
  review: VerificationReviewState;
}) {
  const approve = review.target?.action !== "REJECT";
  return (
    <AdminDialog
      open={review.open}
      onOpenChange={(next) => {
        if (!next) review.close();
      }}
      busy={review.saving}
      title={approve ? "Approve this ID?" : "Reject this ID?"}
      description={
        approve
          ? "The account is marked as verified."
          : "They see your note on their dashboard and can upload a new ID."
      }
    >
      {approve ? (
        <DialogActions>
          <button
            type="button"
            onClick={review.close}
            disabled={review.saving}
            className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => review.confirm()}
            disabled={review.saving}
            aria-busy={review.saving || undefined}
            className={cn(primaryButton, "min-h-11 sm:min-w-28")}
          >
            {review.saving ? "Saving..." : "Approve"}
          </button>
        </DialogActions>
      ) : (
        <DecisionNoteForm
          key={review.target?.decideId}
          label="Why is this ID rejected?"
          submitLabel="Reject"
          saving={review.saving}
          onCancel={review.close}
          onSubmit={(note) => review.confirm(note)}
        />
      )}
    </AdminDialog>
  );
}

/** A required note for a rejection or take-down. Validates on submit, then calls `onSubmit` with the trimmed note. */
export function DecisionNoteForm({
  label,
  submitLabel,
  saving,
  onCancel,
  onSubmit,
}: {
  label: string;
  submitLabel: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const noteError = validateDecisionNote(note);
  const shownError = submitted ? noteError : undefined;

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (noteError) return;
    onSubmit(note.trim());
  }

  return (
    <form noValidate onSubmit={onFormSubmit}>
      <Field
        label={label}
        hint="They see this note on their dashboard. 3 to 500 characters."
        error={shownError}
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
            secondaryButton,
            "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
          )}
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </DialogActions>
    </form>
  );
}

/* ───────── Page ───────── */

export function AdminVerificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const kind = parseKind(searchParams.get("kind"));
  const status = parseStatus(searchParams.get("status"));
  const queue = useAdminVerifications(kind, status);
  const review = useVerificationReview();

  const rows = queue.data?.pages.flatMap((page) => page.rows) ?? [];

  /** Both filters always sit in the URL, so a shared link opens the same queue. */
  function update(next: {
    kind?: VerificationKind;
    status?: VerificationStatus;
  }) {
    const params = new URLSearchParams({
      kind: next.kind ?? kind,
      status: next.status ?? status,
    });
    router.replace(`${PATH}?${params.toString()}`, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Verifications"
      description="Check each ID against the name and number on the account before you decide."
    >
      <div className="grid gap-3">
        <FilterChips
          label="Account type"
          value={kind}
          options={KIND_OPTIONS}
          onChange={(value) => update({ kind: value })}
        />
        <FilterChips
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => update({ status: value })}
        />
      </div>

      <QueryState
        query={queue}
        isEmpty={rows.length === 0}
        loadingLabel="Loading ID submissions"
        errorText="Couldn't load these ID submissions."
        emptyText={EMPTY_COPY[status]}
      >
        <ul className="grid gap-4">
          {rows.map((row) => (
            <li
              key={`${row.kind}-${row.decideId}`}
              className={cn(card, "grid gap-4 p-5")}
            >
              <VerificationCard
                row={row}
                onApprove={() => review.start(row, "APPROVE")}
                onReject={() => review.start(row, "REJECT")}
              />
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <LoadMore query={queue} />
        </div>
      </QueryState>

      <VerificationReviewDialog review={review} />
    </AdminPage>
  );
}

function VerificationCard({
  row,
  onApprove,
  onReject,
}: {
  row: VerificationRow;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = row.status === "PENDING";
  const meta = VERIFICATION_STATUS_META[row.status];
  const file = row.file;
  const audience = row.kind === "tutors" ? "tutor" : "student";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-balance break-words text-[var(--color-neutral-charcoal)]">
            {row.name}
          </h2>
          {row.institute && (
            <p className="mt-1 text-sm text-pretty break-words text-[var(--color-text-secondary)]">
              {row.institute}
            </p>
          )}
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>

      <div className="grid gap-1 text-sm text-[var(--color-neutral-charcoal)]">
        <p className="break-words">
          <span className="text-[var(--color-text-secondary)]">Student ID</span>{" "}
          <span className="tabular-nums">
            {row.studentIdNumber || "Not added"}
          </span>
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          Submitted {formatDateTime(row.submittedAt) || "—"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-3">
        {file ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--color-neutral-charcoal)]">
              {file.fileName ?? "Untitled file"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
              {`${fileTypeText(file.contentType)} · ${formatBytes(file.sizeBytes)}`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">No file</p>
        )}
      </div>

      {row.status === "REJECTED" && row.note && (
        <div className="grid gap-1 border-t border-[var(--color-neutral-border)] pt-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            {`Note for the ${audience}`}
          </p>
          <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
            {row.note}
          </p>
        </div>
      )}

      {(pending || file) && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {file ? (
            <button
              type="button"
              onClick={() => {
                openFile(file.id).catch((err) =>
                  toastError("Couldn't open the file.", err),
                );
              }}
              className={cn(secondaryButton, "min-h-11")}
            >
              View document
            </button>
          ) : (
            <span />
          )}
          {pending && (
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onReject}
                className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={onApprove}
                className={cn(primaryButton, "min-h-11 sm:min-w-28")}
              >
                Approve
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
