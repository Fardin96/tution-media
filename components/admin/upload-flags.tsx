"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ghostButton } from "@/components/profile/styles";
import { AdminDialog, StatusPill } from "@/components/admin/admin-ui";
import {
  ReviewNoteForm,
  type ReviewSubmit,
} from "@/components/admin/review-dialog";
import {
  issueText,
  repeatedIssues,
  uploadHistoryHref,
  type UploadFlags,
} from "@/lib/admin-moderation";
import {
  removeFileText,
  showUnverifyOption,
  useRemoveFile,
  type RemoveFileTarget,
} from "@/lib/admin-files";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

/**
 * Recent problems and an active pause for one account, with a link to its upload history.
 * Renders nothing for an account with no issues and no pause.
 */
export function UploadFlagsNote({
  uploadFlags,
  accountId,
}: {
  uploadFlags: UploadFlags;
  accountId: string;
}) {
  const issues = issueText(uploadFlags.recentIssues);
  if (!issues && !uploadFlags.uploadsBlocked) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {issues && (
        <span className="text-[var(--color-text-secondary)] tabular-nums">
          {issues}
        </span>
      )}
      {repeatedIssues(uploadFlags.recentIssues) && (
        <StatusPill tone="warning">Repeated issues</StatusPill>
      )}
      {uploadFlags.uploadsBlocked && (
        <StatusPill tone="warning">Uploads paused</StatusPill>
      )}
      <Link
        href={uploadHistoryHref(accountId)}
        className={cn(ghostButton, "min-h-10 px-3")}
      >
        Upload history
      </Link>
    </div>
  );
}

/** Static cue next to a note the user cannot see. */
export function HiddenFromUser() {
  return <StatusPill tone="neutral">Hidden from the user</StatusPill>;
}

type RemoveFileReviewTarget = RemoveFileTarget & { key: string };

/**
 * The Remove file dialog's state. The dialog stays mounted through its close animation, so
 * `target` keeps its last value and only `open` goes false.
 */
export function useRemoveFileReview() {
  const [target, setTarget] = useState<RemoveFileReviewTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [unverify, setUnverify] = useState(false);
  const remove = useRemoveFile();

  function start(next: RemoveFileTarget) {
    setTarget({ ...next, key: `${next.fileId}-${Date.now()}` });
    setUnverify(false);
    setOpen(true);
  }

  function close() {
    if (!remove.isPending) setOpen(false);
  }

  function confirm(value: ReviewSubmit) {
    if (!target) return;
    remove.mutate(
      {
        fileId: target.fileId,
        body: {
          note: value.note ?? "",
          noteVisible: value.noteVisible,
          unverify: showUnverifyOption(target) && unverify,
        },
      },
      {
        onSuccess: () => {
          toastSuccess("File removed");
          setOpen(false);
        },
        onError: (err) => {
          toastError("Couldn't remove the file.", err);
          // 404 or 409: the file or ID already changed. The lists refetch on settle.
          if (
            err instanceof ApiError &&
            (err.status === 404 || err.status === 409)
          ) {
            setOpen(false);
          }
        },
      },
    );
  }

  return {
    target,
    open,
    unverify,
    setUnverify,
    start,
    close,
    confirm,
    saving: remove.isPending,
  };
}

export type RemoveFileReview = ReturnType<typeof useRemoveFileReview>;

/** Removes a file with a required note. Shared by the verifications, videos and files pages. */
export function RemoveFileDialog({ review }: { review: RemoveFileReview }) {
  const target = review.target;
  const showUnverify = target ? showUnverifyOption(target) : false;
  return (
    <AdminDialog
      open={review.open}
      onOpenChange={(next) => {
        if (!next) review.close();
      }}
      busy={review.saving}
      title="Remove this file?"
      description={target ? removeFileText(target) : undefined}
    >
      {target && (
        <ReviewNoteForm
          key={target.key}
          noteLabel="Why is this file removed?"
          noteRequired
          submitLabel="Remove file"
          danger
          saving={review.saving}
          extra={
            showUnverify ? (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={review.unverify}
                  onChange={(e) => review.setUnverify(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary-core)]"
                />
                <span className="grid gap-0.5">
                  <span className="font-semibold text-[var(--color-neutral-charcoal)]">
                    Also remove verified status
                  </span>
                  <span className="text-[var(--color-text-secondary)]">
                    Leave this off to keep them verified without the file.
                  </span>
                </span>
              </label>
            ) : undefined
          }
          onCancel={review.close}
          onSubmit={review.confirm}
        />
      )}
    </AdminDialog>
  );
}
