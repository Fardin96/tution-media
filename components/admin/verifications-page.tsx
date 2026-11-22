"use client";

import { useState } from "react";
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
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
} from "@/components/admin/admin-ui";
import {
  HiddenFromUser,
  RemoveFileDialog,
  UploadFlagsNote,
  useRemoveFileReview,
} from "@/components/admin/upload-flags";
import {
  ReviewNoteForm,
  type ReviewSubmit,
} from "@/components/admin/review-dialog";
import { formatDateTime } from "@/lib/admin";
import {
  fileTypeText,
  useAdminVerifications,
  useDecideVerification,
  verificationActions,
  VERIFICATION_STATUS_META,
  type DecideVerificationInput,
  type VerificationKind,
  type VerificationRow,
  type VerificationStatus,
} from "@/lib/admin-verifications";
import { openFile, formatBytes } from "@/lib/files";
import { FilePreview } from "@/components/files/file-preview";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";
import { PendingLabel } from "@/components/ui/pending-label";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { Expand } from "@/components/motion/expand";

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

/* ───────── Approve, reject and revoke ───────── */

type DecisionTarget = {
  key: string;
  kind: VerificationKind;
  decideId: string;
  action: "APPROVE" | "REJECT";
  /** A reject of an approved ID. */
  revoke: boolean;
};

/**
 * One decision at a time. The dialog stays mounted through its close animation, so `target`
 * keeps its last value and only `open` goes false.
 */
export function useVerificationReview() {
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const [open, setOpen] = useState(false);
  const decide = useDecideVerification();

  function start(row: VerificationRow, action: "APPROVE" | "REJECT") {
    setTarget({
      key: `${row.decideId}-${Date.now()}`,
      kind: row.kind,
      decideId: row.decideId,
      action,
      revoke: action === "REJECT" && row.status === "APPROVED",
    });
    setOpen(true);
  }

  function close() {
    if (!decide.isPending) setOpen(false);
  }

  function confirm({ note, noteVisible }: ReviewSubmit) {
    if (!target) return;
    const body: DecideVerificationInput =
      target.action === "APPROVE"
        ? { decision: "APPROVE", note, noteVisible }
        : { decision: "REJECT", note, noteVisible };
    const successText =
      target.action === "APPROVE"
        ? "ID approved"
        : target.revoke
          ? "Approval revoked"
          : "ID rejected";
    decide.mutate(
      { kind: target.kind, id: target.decideId, body },
      {
        onSuccess: () => {
          toastSuccess(successText);
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

  return { target, open, start, close, confirm, saving: decide.isPending };
}

export type VerificationReviewState = ReturnType<typeof useVerificationReview>;

function VerificationReviewDialog({
  review,
}: {
  review: VerificationReviewState;
}) {
  const target = review.target;
  const approve = target?.action === "APPROVE";
  const revoke = target?.revoke ?? false;

  const title = approve
    ? "Approve this ID?"
    : revoke
      ? "Revoke approval?"
      : "Reject this ID?";
  const description = approve
    ? "The account is marked as verified."
    : revoke
      ? "The account loses its verified status. The user sees your note and can upload a new ID."
      : "They see your note on their dashboard and can upload a new ID.";

  return (
    <AdminDialog
      open={review.open}
      onOpenChange={(next) => {
        if (!next) review.close();
      }}
      busy={review.saving}
      title={title}
      description={description}
    >
      {target && (
        <ReviewNoteForm
          key={target.key}
          noteLabel={approve ? "Note for the user" : "Why is this ID rejected?"}
          noteRequired={!approve}
          submitLabel={
            approve ? "Approve" : revoke ? "Revoke approval" : "Reject"
          }
          danger={!approve}
          saving={review.saving}
          onCancel={review.close}
          onSubmit={review.confirm}
        />
      )}
    </AdminDialog>
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
  const removal = useRemoveFileReview();

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
          {rows.map((row, index) => (
            <li
              key={`${row.kind}-${row.decideId}`}
              className={cn(card, "grid gap-4 p-5", enterClass)}
              style={enterStyle(index)}
            >
              <VerificationCard
                row={row}
                onApprove={() => review.start(row, "APPROVE")}
                onReject={() => review.start(row, "REJECT")}
                onRemove={() => {
                  if (!row.file) return;
                  removal.start({
                    fileId: row.file.id,
                    fileName: row.file.fileName,
                    purpose: row.kind === "tutors" ? "TUTOR_ID" : "STUDENT_ID",
                    idStatus: row.status,
                  });
                }}
              />
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <LoadMore query={queue} />
        </div>
      </QueryState>

      <VerificationReviewDialog review={review} />
      <RemoveFileDialog review={removal} />
    </AdminPage>
  );
}

function VerificationCard({
  row,
  onApprove,
  onReject,
  onRemove,
}: {
  row: VerificationRow;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
}) {
  const meta = VERIFICATION_STATUS_META[row.status];
  const file = row.file;
  const fileRemoved = file?.status === "DELETED";
  const audience = row.kind === "tutors" ? "tutor" : "student";
  const actions = verificationActions(row);
  const [showPreview, setShowPreview] = useState(false);
  const [opening, setOpening] = useState(false);
  const canOpen = file !== null && !fileRemoved;

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

      <UploadFlagsNote
        uploadFlags={row.uploadFlags}
        accountId={row.accountId}
      />

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
        {!file && (
          <p className="text-sm text-[var(--color-text-secondary)]">No file</p>
        )}
        {file && fileRemoved && (
          <p className="text-sm font-semibold text-[var(--color-semantic-error-text)]">
            File removed
          </p>
        )}
        {file && !fileRemoved && (
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold break-all text-[var(--color-neutral-charcoal)]">
              {file.fileName ?? "Untitled file"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
              {`${fileTypeText(file.contentType)} · ${formatBytes(file.sizeBytes)}`}
            </p>
          </div>
        )}
      </div>

      {row.note && (
        <div className="grid gap-1 border-t border-[var(--color-neutral-border)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {`Note for the ${audience}`}
            </p>
            {!row.noteVisible && <HiddenFromUser />}
          </div>
          <p className="text-sm text-pretty break-words text-[var(--color-neutral-charcoal)]">
            {row.note}
          </p>
        </div>
      )}

      {!row.isLatest && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          A newer submission replaced this one.
        </p>
      )}

      {file && (
        <Expand open={canOpen && showPreview}>
          <FilePreview
            fileId={file.id}
            contentType={file.contentType}
            name={file.fileName}
          />
        </Expand>
      )}

      {(canOpen ||
        actions.reject ||
        actions.approve ||
        actions.revoke ||
        actions.removeFile) && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {canOpen && file ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                aria-expanded={showPreview}
                onClick={() => setShowPreview((open) => !open)}
                className={cn(secondaryButton, "min-h-11")}
              >
                {showPreview ? "Hide preview" : "Preview document"}
              </button>
              <button
                type="button"
                disabled={opening}
                aria-busy={opening || undefined}
                onClick={() => {
                  setOpening(true);
                  openFile(file.id)
                    .catch((err) => toastError("Couldn't open the file.", err))
                    .finally(() => setOpening(false));
                }}
                className={cn(secondaryButton, "min-h-11")}
              >
                <PendingLabel pending={opening}>Open in new tab</PendingLabel>
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {actions.reject && (
              <button
                type="button"
                onClick={onReject}
                className={cn(
                  secondaryButton,
                  "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
                )}
              >
                Reject
              </button>
            )}
            {actions.revoke && (
              <button
                type="button"
                onClick={onReject}
                className={cn(
                  secondaryButton,
                  "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
                )}
              >
                Revoke approval
              </button>
            )}
            {actions.removeFile && (
              <button
                type="button"
                onClick={onRemove}
                className={cn(
                  secondaryButton,
                  "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
                )}
              >
                Remove file
              </button>
            )}
            {actions.approve && (
              <button
                type="button"
                onClick={onApprove}
                className={cn(primaryButton, "min-h-11 sm:min-w-28")}
              >
                Approve
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
