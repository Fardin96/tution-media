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
  ReviewNoteForm,
  type ReviewSubmit,
} from "@/components/admin/review-dialog";
import { HiddenFromUser } from "@/components/admin/upload-flags";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { formatDateTime } from "@/lib/admin";
import {
  STORY_STATUS_META,
  roleText,
  useAdminStories,
  useModerateStory,
  type AdminStory,
  type ModerateStoryInput,
  type StoryFilters,
  type StoryRole,
  type StoryStatus,
} from "@/lib/admin-stories";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";
import { useRefreshExpiredMedia } from "@/lib/files";

const PATH = "/dashboard/admin/stories";

type RoleFilter = "ALL" | StoryRole;

const STATUS_OPTIONS: { value: StoryStatus; label: string }[] = [
  { value: "PENDING", label: "Waiting for review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "STUDENT", label: "Students" },
  { value: "TUTOR", label: "Tutors" },
];

const EMPTY_COPY: Record<StoryStatus, string> = {
  PENDING: "No stories waiting for review.",
  APPROVED: "No approved stories yet.",
  REJECTED: "No rejected stories.",
};

function parseStatus(value: string | null): StoryStatus {
  return (
    STATUS_OPTIONS.find((option) => option.value === value)?.value ?? "PENDING"
  );
}

function parseRole(value: string | null): RoleFilter {
  return ROLE_OPTIONS.find((option) => option.value === value)?.value ?? "ALL";
}

/* ───────── Review state and dialog ───────── */

type StoryAction = "APPROVE" | "REJECT";

type StoryReviewTarget = {
  key: string;
  id: string;
  action: StoryAction;
  onLanding: boolean;
};

/** The dialog stays mounted through its close animation, so `target` keeps its last value. */
function useStoryReview() {
  const [target, setTarget] = useState<StoryReviewTarget | null>(null);
  const [open, setOpen] = useState(false);
  const moderate = useModerateStory();

  function start(story: AdminStory, action: StoryAction) {
    setTarget({
      key: `${story.id}-${action}-${Date.now()}`,
      id: story.id,
      action,
      onLanding: story.onLanding,
    });
    setOpen(true);
  }

  function close() {
    if (!moderate.isPending) setOpen(false);
  }

  function confirm({ note, noteVisible }: ReviewSubmit) {
    if (!target) return;
    const body: ModerateStoryInput =
      target.action === "APPROVE"
        ? note
          ? { decision: "APPROVE", note, noteVisible }
          : { decision: "APPROVE" }
        : { decision: "REJECT", note, noteVisible };
    moderate.mutate(
      { id: target.id, body },
      {
        onSuccess: () => {
          toastSuccess(
            target.action === "APPROVE" ? "Story approved" : "Story rejected",
          );
          setOpen(false);
        },
        onError: (err) => {
          toastError("Couldn't save the decision.", err);
          // 409: the story already has that decision. The list refetches on settle.
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

type StoryReviewState = ReturnType<typeof useStoryReview>;

function dialogCopy(action: StoryAction, onLanding: boolean) {
  if (action === "APPROVE") {
    return {
      title: "Approve this story?",
      description:
        "The author gets an alert. You can add it to the home page from Site content.",
    };
  }
  return {
    title: "Reject this story?",
    description: `The author sees your note.${onLanding ? " This takes it off the home page." : ""}`,
  };
}

function StoryReviewDialog({ review }: { review: StoryReviewState }) {
  const action = review.target?.action ?? "APPROVE";
  const copy = dialogCopy(action, review.target?.onLanding ?? false);
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
      {review.target && (
        <ReviewNoteForm
          key={review.target.key}
          noteLabel={
            action === "APPROVE"
              ? "Note for the author"
              : "Why is this rejected?"
          }
          noteRequired={action === "REJECT"}
          submitLabel={action === "APPROVE" ? "Approve" : "Reject"}
          danger={action === "REJECT"}
          saving={review.saving}
          onCancel={review.close}
          onSubmit={review.confirm}
        />
      )}
    </AdminDialog>
  );
}

/* ───────── Page ───────── */

export function AdminStoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = parseStatus(searchParams.get("status"));
  const role = parseRole(searchParams.get("role"));
  const filters: StoryFilters = role === "ALL" ? { status } : { status, role };
  const queue = useAdminStories(filters);
  const review = useStoryReview();

  const stories = queue.data?.pages.flatMap((page) => page.stories) ?? [];

  function updateUrl(next: { status: StoryStatus; role: RoleFilter }) {
    const params = new URLSearchParams({ status: next.status });
    if (next.role !== "ALL") params.set("role", next.role);
    router.replace(`${PATH}?${params.toString()}`, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Stories"
      description="Testimonials and stories from students and tutors. Approved ones can be added to the home page from Site content."
    >
      <div className="grid gap-2">
        <FilterChips
          label="Story status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => updateUrl({ status: value, role })}
        />
        <FilterChips
          label="Author role"
          value={role}
          options={ROLE_OPTIONS}
          onChange={(value) => updateUrl({ status, role: value })}
        />
      </div>

      <QueryState
        query={queue}
        isEmpty={stories.length === 0}
        loadingLabel="Loading stories"
        errorText="Couldn't load these stories."
        emptyText={EMPTY_COPY[status]}
      >
        <ul className="grid gap-6">
          {stories.map((story, index) => (
            <li
              key={story.id}
              className={cn(card, "grid gap-3 p-5", enterClass)}
              style={enterStyle(index)}
            >
              <StoryCard
                story={story}
                onApprove={() => review.start(story, "APPROVE")}
                onReject={() => review.start(story, "REJECT")}
              />
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <LoadMore query={queue} />
        </div>
      </QueryState>

      <StoryReviewDialog review={review} />
    </AdminPage>
  );
}

function StoryCard({
  story,
  onApprove,
  onReject,
}: {
  story: AdminStory;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = STORY_STATUS_META[story.status];
  const refreshExpired = useRefreshExpiredMedia();
  const pending = story.status === "PENDING";
  const approved = story.status === "APPROVED";
  const rejected = story.status === "REJECTED";
  const { image, video } = story;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <p className="text-sm font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {story.author.name}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {roleText(story.author.role)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          {story.onLanding && (
            <StatusPill tone="info">On the home page</StatusPill>
          )}
        </div>
      </div>

      <div className="grid gap-1 text-xs text-[var(--color-text-secondary)] tabular-nums">
        <p>Agreed to home page use on {formatDateTime(story.consentAt)}</p>
        <p>Sent {formatDateTime(story.createdAt)}</p>
      </div>

      {story.headline && (
        <h2 className="text-lg font-semibold text-balance break-words text-[var(--color-neutral-charcoal)]">
          {story.headline}
        </h2>
      )}
      <p className="text-sm text-pretty break-words whitespace-pre-line text-[var(--color-neutral-charcoal)]">
        {story.body}
      </p>

      {image &&
        (image.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Signed R2 URLs are not configured for next/image.
          <img
            src={image.url}
            alt={`Photo from ${story.author.name}`}
            loading="lazy"
            onError={refreshExpired}
            className="max-h-96 w-full rounded-[16px] bg-[var(--color-neutral-off-white)] object-cover outline outline-1 -outline-offset-1 outline-black/10"
          />
        ) : (
          <MediaUnavailable />
        ))}

      {video &&
        (video.url ? (
          <video
            controls
            preload="metadata"
            src={video.url}
            aria-label={`Video from ${story.author.name}`}
            onError={refreshExpired}
            className="aspect-video w-full rounded-[16px] bg-black outline outline-1 -outline-offset-1 outline-black/10"
          />
        ) : (
          <MediaUnavailable />
        ))}

      {story.note && (
        <div className="grid gap-1 border-t border-[var(--color-neutral-border)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Note for the author
            </p>
            {!story.noteVisible && <HiddenFromUser />}
          </div>
          <p className="text-sm text-pretty break-words text-[var(--color-neutral-charcoal)]">
            {story.note}
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
        <div className="flex justify-end border-t border-[var(--color-neutral-border)] pt-3">
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
    </>
  );
}

function MediaUnavailable() {
  return (
    <div className="flex aspect-video items-center justify-center rounded-[16px] bg-[var(--color-neutral-off-white)] text-sm text-[var(--color-text-secondary)]">
      Preview not available
    </div>
  );
}
