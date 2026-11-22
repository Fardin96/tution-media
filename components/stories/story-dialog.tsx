"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AdminDialog,
  DialogActions,
  Field,
  inputClass,
  textareaClass,
} from "@/components/admin/admin-ui";
import { FilePicker } from "@/components/files/file-picker";
import { PendingLabel } from "@/components/ui/pending-label";
import { PausedNotice } from "@/components/profile/dashboard-kit";
import { FieldError } from "@/components/profile/profile-fields";
import {
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { errorCodeMessage } from "@/lib/api-errors";
import type { FileAsset } from "@/lib/files";
import { MEDIA_GUIDES } from "@/lib/site-media-guides";
import {
  STORY_LIMITS,
  useCreateStory,
  validateStoryForm,
  type CreateStoryInput,
  type StoryRole,
  type StoryForm,
} from "@/lib/stories";
import { pausedText, useUploadStatus } from "@/lib/upload-status";
import { wordCount } from "@/lib/site-content-schema";
import { cn } from "@/lib/utils";

const COPY: Record<StoryRole, { title: string; description: string }> = {
  STUDENT: {
    title: "Add a testimonial",
    description: "Tell other guardians and students how tutoring went.",
  },
  TUTOR: {
    title: "Add your story",
    description: "A few lines about how you teach.",
  },
};

export function StoryDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: StoryRole;
}) {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={COPY[role].title}
      description={COPY[role].description}
    >
      <StoryForm role={role} onDone={() => onOpenChange(false)} />
    </AdminDialog>
  );
}

/** A hint line with live counts; a count over its limit turns red. */
function Counts({
  hint,
  counts,
}: {
  hint?: string;
  counts: { text: string; over: boolean }[];
}) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {hint && <span>{hint}</span>}
      {counts.map((count) => (
        <span
          key={count.text}
          className={cn(
            "tabular-nums",
            count.over && "text-[var(--color-semantic-error-text)]",
          )}
        >
          {count.text}
        </span>
      ))}
    </span>
  );
}

function StoryForm({ role, onDone }: { role: StoryRole; onDone: () => void }) {
  const student = role === "STUDENT";
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<FileAsset | null>(null);
  const [video, setVideo] = useState<FileAsset | null>(null);
  const [consent, setConsent] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Errors show after the first submit attempt, then update as the user types.
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const uploadStatus = useUploadStatus();
  const photoPaused = pausedText(uploadStatus.data, "documents");
  const videoPaused = pausedText(uploadStatus.data, "videos");
  const createStory = useCreateStory();

  const values: StoryForm = {
    headline,
    body,
    imageFileId: image?.id ?? null,
    videoFileId: student ? (video?.id ?? null) : null,
    consent,
  };
  const errors = submitted ? validateStoryForm(role, values) : {};
  const busy = imageBusy || videoBusy || submitting;

  const bodyChars = body.trim().length;
  const bodyLimit = student
    ? STORY_LIMITS.studentBodyChars
    : STORY_LIMITS.tutorBodyChars;
  const bodyWords = wordCount(body.trim());
  const headlineChars = headline.trim().length;

  const submit = async () => {
    if (busy) return;
    setSubmitted(true);
    setFormError(null);
    if (Object.keys(validateStoryForm(role, values)).length > 0) return;
    setSubmitting(true);
    const payload: CreateStoryInput = student
      ? {
          headline: headline.trim(),
          body: body.trim(),
          ...(image ? { imageFileId: image.id } : {}),
          ...(video ? { videoFileId: video.id } : {}),
          consent: true,
        }
      : {
          body: body.trim(),
          ...(image ? { imageFileId: image.id } : {}),
          consent: true,
        };
    try {
      await createStory.mutateAsync(payload);
      toast.success("Story sent for review");
      onDone();
    } catch (err) {
      setFormError(
        errorCodeMessage(err) ?? "Couldn't send your story. Try again.",
      );
      setSubmitting(false);
    }
  };

  const photoGuide = student
    ? MEDIA_GUIDES.testimonialPhoto.shape
    : MEDIA_GUIDES.showcasePoster.shape;
  const consentId = "story-consent";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="grid grid-cols-[minmax(0,1fr)] gap-6"
    >
      {student && (
        <Field
          label="Headline"
          hint={
            <Counts
              hint="Shown in large type on the card."
              counts={[
                {
                  text: `${headlineChars}/${STORY_LIMITS.headlineChars}`,
                  over: headlineChars > STORY_LIMITS.headlineChars,
                },
              ]}
            />
          }
          error={errors.headline}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              autoComplete="off"
              disabled={submitting}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={inputClass}
            />
          )}
        </Field>
      )}

      <Field
        label="Your story"
        hint={
          <Counts
            counts={
              student
                ? [
                    {
                      text: `${bodyChars}/${bodyLimit} characters`,
                      over: bodyChars > bodyLimit,
                    },
                    {
                      text: `${bodyWords}/${STORY_LIMITS.studentBodyWords} words`,
                      over: bodyWords > STORY_LIMITS.studentBodyWords,
                    },
                  ]
                : [
                    {
                      text: `${bodyChars}/${bodyLimit} characters`,
                      over: bodyChars > bodyLimit,
                    },
                  ]
            }
          />
        }
        error={errors.body}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            disabled={submitting}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={textareaClass}
          />
        )}
      </Field>

      {photoPaused ? (
        <PausedNotice text={photoPaused} note={uploadStatus.data?.note} />
      ) : (
        <Field
          label="Photo (optional)"
          hint={photoGuide}
          error={errors.imageFileId}
        >
          {({ id, describedBy, invalid }) => (
            <FilePicker
              purpose="STORY_IMAGE"
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              value={image}
              onChange={setImage}
              onBusyChange={setImageBusy}
              disabled={submitting}
              chooseLabel="Choose a photo"
            />
          )}
        </Field>
      )}

      {student &&
        (videoPaused ? (
          <PausedNotice text={videoPaused} note={uploadStatus.data?.note} />
        ) : (
          <Field
            label="Video (optional)"
            hint={MEDIA_GUIDES.testimonialVideo.shape}
            error={errors.videoFileId}
          >
            {({ id, describedBy, invalid }) => (
              <FilePicker
                purpose="STORY_VIDEO"
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                value={video}
                onChange={setVideo}
                onBusyChange={setVideoBusy}
                disabled={submitting}
                chooseLabel="Choose a video"
              />
            )}
          </Field>
        ))}

      <div className="grid min-w-0 gap-1.5">
        <label className="flex min-h-11 items-start gap-3 text-sm text-[var(--color-neutral-charcoal)]">
          <input
            id={consentId}
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={submitting}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? `${consentId}-error` : undefined}
            className={cn(
              "mt-2.5 size-5 shrink-0 rounded-[4px] accent-[var(--color-primary-core)]",
              focusRing,
            )}
          />
          <span className="pt-2.5 text-pretty">
            Masters Hub may show this on its website with my name.
          </span>
        </label>
        <FieldError id={`${consentId}-error`} message={errors.consent} />
      </div>

      <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
        You can&apos;t edit a story after sending it. Delete it and send a new
        one instead.
      </p>

      {formError && (
        <p
          role="alert"
          className="rounded-[12px] bg-[var(--color-semantic-error-surface)] px-3 py-2 text-sm text-pretty text-[var(--color-semantic-error-text)]"
        >
          {formError}
        </p>
      )}

      <DialogActions>
        <button type="button" onClick={onDone} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={imageBusy || videoBusy || submitting}
          aria-busy={submitting || undefined}
          className={primaryButton}
        >
          <PendingLabel pending={submitting}>Send for review</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}
