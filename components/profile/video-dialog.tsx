"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AdminDialog,
  DialogActions,
  Field,
  inputClass,
} from "@/components/admin/admin-ui";
import { FilePicker } from "@/components/files/file-picker";
import type { FileAsset } from "@/lib/files";
import { toastError } from "@/lib/toast";
import { profileApi, type Video } from "@/lib/profile";
import { validateVideoForm } from "@/lib/upload-forms";
import { primaryButton, secondaryButton } from "./styles";

export function VideoDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (video: Video) => void;
}) {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add video"
      description="A short demo lesson. Admins review it before it goes live."
    >
      <VideoForm onAdded={onAdded} onDone={() => onOpenChange(false)} />
    </AdminDialog>
  );
}

function VideoForm({
  onAdded,
  onDone,
}: {
  onAdded: (video: Video) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<FileAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Errors show after the first submit attempt, then update as the user types.
  const [submitted, setSubmitted] = useState(false);

  const values = { title, fileId: file?.id ?? null };
  const errors = submitted ? validateVideoForm(values) : {};

  const submit = async () => {
    if (submitting) return;
    setSubmitted(true);
    if (Object.keys(validateVideoForm(values)).length > 0 || !file) return;
    setSubmitting(true);
    try {
      const video = await profileApi.addVideo({
        title: title.trim(),
        fileId: file.id,
      });
      toast.success("Video sent for review");
      onAdded(video);
      onDone();
    } catch (err) {
      toastError("Couldn't add the video.", err);
      setSubmitting(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="grid gap-5"
    >
      <Field
        label="Title"
        hint="Like Algebra: solving linear equations."
        error={errors.title}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            autoComplete="off"
            disabled={submitting}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </Field>
      <Field label="Video file" error={errors.fileId}>
        {({ id, describedBy, invalid }) => (
          <FilePicker
            purpose="TUTOR_VIDEO"
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            value={file}
            onChange={setFile}
            onBusyChange={setUploading}
            disabled={submitting}
            chooseLabel="Choose a video"
          />
        )}
      </Field>
      <DialogActions>
        <button type="button" onClick={onDone} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!file || uploading || submitting}
          className={primaryButton}
        >
          {submitting ? "Sending…" : "Send for review"}
        </button>
      </DialogActions>
    </form>
  );
}
