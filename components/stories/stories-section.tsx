"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Quote, Trash2 } from "lucide-react";
import {
  AddButton,
  EmptyState,
  loadFailed,
  Pill,
  SectionHeading,
} from "@/components/profile/dashboard-kit";
import { card, ghostButton } from "@/components/profile/styles";
import {
  ConfirmDialog,
  type ConfirmAction,
} from "@/components/ui/confirm-dialog";
import { useRefreshExpiredMedia } from "@/lib/files";
import { toastError } from "@/lib/toast";
import {
  blockedText,
  formatStoryDate,
  STORY_STATUS,
  storyTitle,
  useDeleteStory,
  useMyStories,
  type Story,
  type StoryRole,
} from "@/lib/stories";
import { cn } from "@/lib/utils";
import { StoryDialog } from "./story-dialog";

const COPY: Record<
  StoryRole,
  {
    title: string;
    description: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  STUDENT: {
    title: "Add a testimonial",
    description:
      "Tell other guardians and students how tutoring went. If an admin approves it, we may show it on our home page with your name.",
    emptyTitle: "No testimonials yet",
    emptyBody: "Share how tutoring went for you.",
  },
  TUTOR: {
    title: "Your story",
    description:
      "A few lines about how you teach. If an admin approves it, we may show it on our home page with your name.",
    emptyTitle: "No story yet",
    emptyBody: "A short note helps families get to know you.",
  },
};

export function StoriesSection({ role }: { role: StoryRole }) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Story | null>(null);
  const stories = useMyStories();
  const remove = useDeleteStory();
  const data = stories.data;
  const copy = COPY[role];

  // The dialog stays open while the delete runs, and closes once the list has refreshed.
  const confirmRemove = async () => {
    if (!removing || remove.isPending) return;
    try {
      await remove.mutateAsync(removing.id);
      setRemoving(null);
      toast.success("Story deleted");
    } catch (err) {
      toastError("Couldn't delete the story.", err);
    }
  };

  const removeActions: ConfirmAction[] = [
    {
      label: "Keep story",
      variant: "secondary",
      onSelect: () => setRemoving(null),
    },
    {
      label: "Delete story",
      variant: "primary",
      onSelect: () => void confirmRemove(),
      pending: remove.isPending,
    },
  ];

  const blocked =
    data && !data.canSubmit ? blockedText(data.blockedReason, data.max) : null;

  return (
    <section
      id="stories"
      aria-labelledby="stories-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="stories-heading"
        title={copy.title}
        description={copy.description}
        action={
          data?.canSubmit ? (
            <AddButton label="Add story" onClick={() => setAdding(true)} />
          ) : undefined
        }
      />
      <div className={cn(card, "mt-5 overflow-hidden")}>
        {stories.isError ? (
          loadFailed
        ) : data ? (
          data.stories.length === 0 ? (
            <EmptyState
              icon={<Quote aria-hidden="true" className="size-5" />}
              title={copy.emptyTitle}
              body={copy.emptyBody}
            />
          ) : (
            <ul className="divide-y divide-[var(--color-neutral-border)]">
              {data.stories.map((story) => (
                <StoryRow
                  key={story.id}
                  story={story}
                  onRemove={() => setRemoving(story)}
                />
              ))}
            </ul>
          )
        ) : null}
      </div>
      {blocked && (
        <p className="mt-3 text-sm text-pretty text-[var(--color-text-secondary)]">
          {blocked}
        </p>
      )}
      <StoryDialog open={adding} onOpenChange={setAdding} role={role} />
      <ConfirmDialog
        open={removing !== null}
        title="Delete this story?"
        actions={removeActions}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      >
        <p>
          It is removed from your dashboard and, if it is on our home page, from
          there too.
        </p>
      </ConfirmDialog>
    </section>
  );
}

function StoryRow({ story, onRemove }: { story: Story; onRemove: () => void }) {
  const refreshExpired = useRefreshExpiredMedia();
  const status = STORY_STATUS[story.status];
  const title = storyTitle(story);
  const hasPreview = Boolean(story.note || story.image || story.video);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
        <Quote aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-medium break-words text-[var(--color-neutral-charcoal)]">
          {title}
        </span>
        <span className="block text-sm text-[var(--color-text-secondary)]">
          Sent {formatStoryDate(story.createdAt)}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        <Pill tone={status.tone}>{status.label}</Pill>
        {story.onLanding && <Pill tone="info">On the home page</Pill>}
      </span>
      <button
        type="button"
        aria-label={`Remove ${title}`}
        onClick={onRemove}
        className={cn(
          ghostButton,
          "min-h-10 px-3 text-[var(--color-text-secondary)] hover:bg-[var(--color-semantic-error-surface)] hover:text-[var(--color-semantic-error-text)]",
        )}
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Remove
      </button>
      {hasPreview && (
        <div className="grid min-w-0 basis-full gap-3 ps-14">
          {story.note && (
            <p
              className={cn(
                "rounded-[12px] px-3 py-2 text-sm text-pretty",
                story.status === "REJECTED"
                  ? "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
              )}
            >
              Admin note: {story.note}
            </p>
          )}
          {story.image &&
            (story.image.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed R2 URLs are not configured for next/image.
              <img
                src={story.image.url}
                alt={`Photo for ${title}`}
                onError={refreshExpired}
                className="size-24 rounded-[12px] object-cover outline outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)]"
              />
            ) : (
              <p className="rounded-[12px] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                Preview unavailable
              </p>
            ))}
          {story.video &&
            (story.video.url ? (
              <video
                controls
                muted
                preload="metadata"
                src={story.video.url}
                onError={refreshExpired}
                aria-label={`Video for ${title}`}
                className="aspect-video w-full max-w-xs rounded-[12px] bg-black outline outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)]"
              />
            ) : (
              <p className="rounded-[12px] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                Preview unavailable
              </p>
            ))}
        </div>
      )}
    </li>
  );
}
