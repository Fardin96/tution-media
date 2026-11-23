"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminDialog, DialogActions, Field } from "@/components/admin/admin-ui";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PendingLabel } from "@/components/ui/pending-label";
import { PhotoError, hasUploadedAvatar, preparePhoto } from "@/lib/avatar";
import { useFileUpload } from "@/lib/files";
import { profileApi, type ProfileRole } from "@/lib/profile";
import {
  invalidateApplications,
  invalidateTutorProfile,
  queryKeys,
} from "@/lib/query-keys";
import { pausedText, useUploadStatus } from "@/lib/upload-status";
import { toastError } from "@/lib/toast";
import { PausedNotice } from "./dashboard-kit";
import { ghostButton, primaryButton, secondaryButton } from "./styles";
import { cn } from "@/lib/utils";

/**
 * Changes or removes the profile photo. The photo is cropped to a square in the browser, so
 * the form has no crop controls. `tutorId` is set for a tutor, whose public page is cached.
 */
export function AvatarDialog({
  open,
  onOpenChange,
  role,
  avatarUrl,
  name,
  tutorId,
  onChanged,
  onExpired,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ProfileRole;
  /** The avatar the API returns: the upload, or the Google picture as a fallback. */
  avatarUrl: string | null;
  name: string;
  tutorId: string | null;
  /** Receives the avatar the API now returns, so the dashboard's copy of the account stays current. */
  onChanged: (avatarUrl: string | null) => void;
  /** The preview's signed link expired: the dashboard refetches the account. */
  onExpired?: () => void;
}) {
  const upload = useFileUpload("AVATAR");
  const { cancel, reset } = upload;
  // Bumped on close. A pick or save still running then drops its result when it lands. The
  // check lives here, not in the form: while the dialog animates out, the form keeps the props
  // it had when it was last shown, so it never sees open=false.
  const session = useRef(0);
  useEffect(() => {
    if (open) return;
    session.current += 1;
    cancel();
    reset();
  }, [open, cancel, reset]);
  useEffect(
    () => () => {
      session.current += 1;
      cancel();
    },
    [cancel],
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Profile picture"
      description={
        // Student photos are hidden from the public reviews endpoint, so they are shown to tutors only.
        role === "TUTOR"
          ? "Your photo shows on your tutor page, in search results and on your applications."
          : "Your photo shows to tutors on your applications."
      }
    >
      <AvatarForm
        upload={upload}
        session={session}
        avatarUrl={avatarUrl}
        name={name}
        tutorId={tutorId}
        onChanged={onChanged}
        onExpired={onExpired}
        onDone={() => onOpenChange(false)}
      />
    </AdminDialog>
  );
}

type Photo = { file: File; url: string };

function AvatarForm({
  upload,
  session,
  avatarUrl,
  name,
  tutorId,
  onChanged,
  onExpired,
  onDone,
}: {
  upload: ReturnType<typeof useFileUpload>;
  session: { current: number };
  avatarUrl: string | null;
  name: string;
  tutorId: string | null;
  onChanged: (avatarUrl: string | null) => void;
  onExpired?: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const { reset } = upload;
  const uploadStatus = useUploadStatus();
  // Avatars are documents for the upload pause, so the admin's ID pause covers them too.
  const paused = pausedText(uploadStatus.data, "documents");

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // The preview's object URL is freed once the photo changes or the form unmounts.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  const busy = preparing || saving || removing;
  const hasUploaded = hasUploadedAvatar(avatarUrl);
  const uploadError =
    upload.state.status === "error" ? upload.state.message : undefined;

  const pick = async (file: File) => {
    const current = session.current;
    reset();
    setPrepareError(null);
    setPreparing(true);
    try {
      const prepared = await preparePhoto(file);
      if (current !== session.current) return;
      setPhoto({ file: prepared, url: URL.createObjectURL(prepared) });
    } catch (err) {
      if (current !== session.current) return;
      setPrepareError(
        err instanceof PhotoError
          ? err.message
          : "Couldn't prepare that photo. Try another one.",
      );
    } finally {
      if (current === session.current) setPreparing(false);
    }
  };

  const save = async () => {
    if (!photo || busy) return;
    const current = session.current;
    setSaving(true);
    const asset = await upload.start(photo.file);
    // Closed during the upload: the transfer was aborted, and a finished one is left unused.
    if (current !== session.current) return;
    if (!asset) {
      setSaving(false);
      return;
    }
    let saved: string | null;
    try {
      ({ avatarUrl: saved } = await profileApi.setAvatar(asset.id));
    } catch (err) {
      if (current !== session.current) return;
      toastError("Couldn't update your profile picture.", err);
      // A 403 here can mean the admin paused uploads; refetch so the notice shows.
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploadStatus });
      // Drop the unsaved preview too, or it would sit beside the paused notice as if it were saved.
      setPhoto(null);
      setSaving(false);
      return;
    }
    // Saved on the server now, so the toast and close go ahead even if the dialog was closed.
    onChanged(saved);
    await refreshAfterAvatarChange(queryClient, tutorId);
    toast.success("Profile picture updated");
    onDone();
  };

  const remove = async () => {
    if (busy) return;
    setRemoving(true);
    let saved: string | null;
    try {
      ({ avatarUrl: saved } = await profileApi.removeAvatar());
    } catch (err) {
      toastError("Couldn't remove your profile picture.", err);
      setRemoving(false);
      return;
    }
    onChanged(saved);
    await refreshAfterAvatarChange(queryClient, tutorId);
    toast.success("Profile picture removed");
    onDone();
  };

  // Always mounted, so a change is announced: the text changes, the region does not come and go.
  const statusText = preparing
    ? "Preparing your photo…"
    : photo && !paused
      ? "Photo ready. Save to use it."
      : "";

  return (
    <div className="grid gap-5">
      <div className="flex justify-center">
        <UserAvatar
          src={photo ? photo.url : avatarUrl}
          name={name}
          size={128}
          onExpired={onExpired}
          className="shadow-[0_0_0_4px_var(--color-neutral-white),0_12px_32px_-8px_rgb(0_0_0/0.25)]"
        />
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="grid gap-5"
      >
        <div className="grid gap-2">
          {paused ? (
            <PausedNotice text={paused} note={uploadStatus.data?.note} />
          ) : (
            <Field
              label="New photo"
              hint="JPG, PNG or WebP. It is cropped to a square."
              error={prepareError ?? uploadError}
            >
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    // Clear the input so picking the same photo again still fires onChange.
                    event.currentTarget.value = "";
                    if (file) void pick(file);
                  }}
                  className={cn(
                    "block w-full min-w-0 text-sm text-[var(--color-neutral-charcoal)] file:me-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--color-secondary-sky)] file:px-4 file:text-sm file:font-semibold file:text-[var(--color-primary-deep)] disabled:opacity-60",
                    invalid && "text-[var(--color-semantic-error-text)]",
                  )}
                />
              )}
            </Field>
          )}
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-[var(--color-text-secondary)]"
          >
            {statusText}
          </p>
        </div>

        <DialogActions>
          {hasUploaded && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              aria-busy={removing || undefined}
              className={cn(
                ghostButton,
                "me-auto min-h-11 px-4 text-[var(--color-semantic-error-text)] hover:bg-[var(--color-semantic-error-surface)] hover:text-[var(--color-semantic-error-text)]",
              )}
            >
              <PendingLabel pending={removing}>Remove photo</PendingLabel>
            </button>
          )}
          {/* Stays enabled during an upload: closing the dialog aborts it. */}
          <button
            type="button"
            onClick={onDone}
            className={cn(secondaryButton, "min-h-11")}
          >
            Cancel
          </button>
          {!paused && (
            <button
              type="submit"
              disabled={!photo || busy}
              aria-busy={saving || undefined}
              className={cn(primaryButton, "min-h-11")}
            >
              <PendingLabel pending={saving}>Save photo</PendingLabel>
            </button>
          )}
        </DialogActions>
      </form>
    </div>
  );
}

/** Every screen that shows an avatar, and the tutor's public page when the user is a tutor. */
async function refreshAfterAvatarChange(
  queryClient: QueryClient,
  tutorId: string | null,
) {
  await Promise.all([
    invalidateApplications(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
    tutorId ? invalidateTutorProfile(queryClient, tutorId) : undefined,
  ]);
}
