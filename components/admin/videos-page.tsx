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
  inputClass,
} from "@/components/admin/admin-ui";
import {
  ReviewNoteForm,
  type ReviewSubmit,
} from "@/components/admin/review-dialog";
import {
  HiddenFromUser,
  RemoveFileDialog,
  UploadFlagsNote,
  useRemoveFileReview,
} from "@/components/admin/upload-flags";
import { formatDateTime } from "@/lib/admin";
import {
  useAdminVideos,
  useModerateVideo,
  useUpdateVideo,
  validateSortOrder,
  VIDEO_STATUS_META,
  type AdminVideo,
  type ModerateVideoInput,
  type VideoStatus,
} from "@/lib/admin-videos";
import { TUTOR_VERIFICATION_LABEL } from "@/lib/admin-verifications";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";
import { useRefreshExpiredMedia } from "@/lib/files";

const PATH = "/dashboard/admin/videos";

const STATUS_OPTIONS: { value: VideoStatus; label: string }[] = [
  { value: "PENDING", label: "Waiting for review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const EMPTY_COPY: Record<VideoStatus, string> = {
  PENDING: "Nothing waiting. New tutor videos show up here.",
  APPROVED: "No approved videos yet.",
  REJECTED: "No rejected videos.",
};

function parseStatus(value: string | null): VideoStatus {
  return (
    STATUS_OPTIONS.find((option) => option.value === value)?.value ?? "PENDING"
  );
}

/* ───────── Review state and dialog ───────── */

type VideoAction = "APPROVE" | "REJECT" | "TAKE_DOWN";

type VideoReviewTarget = {
  key: string;
  id: string;
  action: VideoAction;
};

/** The dialog stays mounted through its close animation, so `target` keeps its last value. */
function useVideoReview() {
  const [target, setTarget] = useState<VideoReviewTarget | null>(null);
  const [open, setOpen] = useState(false);
  const moderate = useModerateVideo();

  function start(video: AdminVideo, action: VideoAction) {
    setTarget({ key: `${video.id}-${Date.now()}`, id: video.id, action });
    setOpen(true);
  }

  function close() {
    if (!moderate.isPending) setOpen(false);
  }

  function confirm({ note, noteVisible }: ReviewSubmit) {
    if (!target) return;
    const body: ModerateVideoInput =
      target.action === "APPROVE"
        ? { decision: "APPROVE" }
        : { decision: "REJECT", note, noteVisible };
    const done = {
      APPROVE: "Video approved",
      REJECT: "Video rejected",
      TAKE_DOWN: "Video taken down",
    } as const;
    moderate.mutate(
      { id: target.id, body },
      {
        onSuccess: () => {
          toastSuccess(done[target.action]);
          setOpen(false);
        },
        onError: (err) => {
          toastError("Couldn't save the decision.", err);
          // 409: the video already has that decision. The list refetches on settle.
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
    saving: moderate.isPending,
  };
}

type VideoReviewState = ReturnType<typeof useVideoReview>;

const DIALOG_COPY: Record<VideoAction, { title: string; description: string }> =
  {
    APPROVE: {
      title: "Approve this video?",
      description: "Students can see it on the tutor's public page.",
    },
    REJECT: {
      title: "Reject this video?",
      description:
        "The tutor sees your note on their dashboard and can replace the video.",
    },
    TAKE_DOWN: {
      title: "Take down this video?",
      description:
        "It hides from the tutor's public page right away. The tutor sees your note.",
    },
  };

function VideoReviewDialog({ review }: { review: VideoReviewState }) {
  const action = review.target?.action ?? "APPROVE";
  const copy = DIALOG_COPY[action];
  return (
    <AdminDialog
      open={review.open}
      onOpenChange={(next) => {
        if (!next) review.close();
      }}
      busy={review.saving}
      title={copy.title}
      description={copy.description}
    >
      {action === "APPROVE" ? (
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
            onClick={() =>
              review.confirm({ note: undefined, noteVisible: true })
            }
            disabled={review.saving}
            aria-busy={review.saving || undefined}
            className={cn(primaryButton, "min-h-11 sm:min-w-28")}
          >
            {review.saving ? "Saving..." : "Approve"}
          </button>
        </DialogActions>
      ) : (
        review.target && (
          <ReviewNoteForm
            key={review.target.key}
            noteLabel={
              action === "TAKE_DOWN"
                ? "Why are you taking it down?"
                : "Why is this video rejected?"
            }
            noteRequired
            submitLabel={action === "TAKE_DOWN" ? "Take down" : "Reject"}
            danger
            saving={review.saving}
            onCancel={review.close}
            onSubmit={review.confirm}
          />
        )
      )}
    </AdminDialog>
  );
}

/* ───────── Page ───────── */

export function AdminVideosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = parseStatus(searchParams.get("status"));
  const queue = useAdminVideos(status);
  const review = useVideoReview();
  const removal = useRemoveFileReview();
  const update = useUpdateVideo();

  const videos = queue.data?.pages.flatMap((page) => page.videos) ?? [];

  function onStatusChange(value: VideoStatus) {
    router.replace(`${PATH}?status=${value}`, { scroll: false });
  }

  function saveOrder(video: AdminVideo, sortOrder: number) {
    update.mutate(
      { id: video.id, body: { sortOrder } },
      {
        onSuccess: () => toastSuccess("Order saved"),
        onError: (err) => toastError("Couldn't save the order.", err),
      },
    );
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Videos"
      description="Tutor videos stay hidden from students until you approve them. Approved videos show on the tutor's public page."
    >
      <FilterChips
        label="Video status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={onStatusChange}
      />

      <QueryState
        query={queue}
        isEmpty={videos.length === 0}
        loadingLabel="Loading videos"
        errorText="Couldn't load these videos."
        emptyText={EMPTY_COPY[status]}
      >
        <ul className="grid gap-4">
          {videos.map((video) => (
            <li key={video.id} className={cn(card, "grid gap-4 p-5")}>
              <VideoCard
                video={video}
                savingOrder={update.isPending}
                onApprove={() => review.start(video, "APPROVE")}
                onReject={() => review.start(video, "REJECT")}
                onTakeDown={() => review.start(video, "TAKE_DOWN")}
                onRemove={() =>
                  removal.start({
                    fileId: video.file.id,
                    fileName: video.file.fileName,
                    purpose: "TUTOR_VIDEO",
                  })
                }
                onSaveOrder={(sortOrder) => saveOrder(video, sortOrder)}
              />
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <LoadMore query={queue} />
        </div>
      </QueryState>

      <VideoReviewDialog review={review} />
      <RemoveFileDialog review={removal} />
    </AdminPage>
  );
}

function VideoCard({
  video,
  savingOrder,
  onApprove,
  onReject,
  onTakeDown,
  onRemove,
  onSaveOrder,
}: {
  video: AdminVideo;
  savingOrder: boolean;
  onApprove: () => void;
  onReject: () => void;
  onTakeDown: () => void;
  onRemove: () => void;
  onSaveOrder: (sortOrder: number) => void;
}) {
  const meta = VIDEO_STATUS_META[video.status];
  const refreshExpired = useRefreshExpiredMedia();
  const pending = video.status === "PENDING";
  const approved = video.status === "APPROVED";
  const rejected = video.status === "REJECTED";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-balance break-words text-[var(--color-neutral-charcoal)]">
            {video.title}
          </h2>
          <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            {video.tutor.name} ·{" "}
            {TUTOR_VERIFICATION_LABEL[video.tutor.verificationStatus]}
          </p>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>

      <UploadFlagsNote
        uploadFlags={video.uploadFlags}
        accountId={video.tutor.accountId}
      />

      <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
        Uploaded {formatDateTime(video.createdAt)}
      </p>

      {video.url ? (
        <video
          controls
          preload="metadata"
          src={video.url}
          onError={refreshExpired}
          className="aspect-video w-full rounded-[16px] bg-black outline outline-1 -outline-offset-1 outline-black/10"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-[16px] bg-[var(--color-neutral-off-white)] text-sm text-[var(--color-text-secondary)]">
          Preview not available
        </div>
      )}

      {video.moderationNote && (
        <div className="grid gap-1 border-t border-[var(--color-neutral-border)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Note for the tutor
            </p>
            {!video.noteVisible && <HiddenFromUser />}
          </div>
          <p className="text-sm text-pretty break-words text-[var(--color-neutral-charcoal)]">
            {video.moderationNote}
          </p>
        </div>
      )}

      {pending && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
          <button
            type="button"
            onClick={onApprove}
            className={cn(primaryButton, "min-h-11 sm:min-w-28")}
          >
            Approve
          </button>
        </div>
      )}

      {approved && (
        <div className="flex flex-col gap-4 border-t border-[var(--color-neutral-border)] pt-4">
          <SortOrderForm
            key={video.sortOrder}
            sortOrder={video.sortOrder}
            saving={savingOrder}
            onSave={onSaveOrder}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onTakeDown}
              className={cn(
                secondaryButton,
                "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
              )}
            >
              Take down
            </button>
          </div>
        </div>
      )}

      {rejected && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onApprove}
            className={cn(primaryButton, "min-h-11 sm:min-w-28")}
          >
            Approve
          </button>
        </div>
      )}

      <div className="flex justify-end border-t border-[var(--color-neutral-border)] pt-3">
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
      </div>
    </>
  );
}

/** Display order for an approved video. Keyed on the saved value so it resets after a refetch. */
function SortOrderForm({
  sortOrder,
  saving,
  onSave,
}: {
  sortOrder: number;
  saving: boolean;
  onSave: (sortOrder: number) => void;
}) {
  const [value, setValue] = useState(String(sortOrder));
  const [submitted, setSubmitted] = useState(false);
  const error = validateSortOrder(value);
  const shownError = submitted ? error : undefined;
  const unchanged = value.trim() === String(sortOrder);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (error) return;
    onSave(Number(value.trim()));
  }

  return (
    <form
      noValidate
      onSubmit={onFormSubmit}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-40 max-w-full">
        <Field
          label="Sort order"
          hint="Lower numbers show first."
          error={shownError}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "tabular-nums")}
            />
          )}
        </Field>
      </div>
      <button
        type="submit"
        disabled={saving || unchanged}
        aria-busy={saving || undefined}
        className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
