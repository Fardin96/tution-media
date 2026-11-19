"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AdminDialog, DialogActions, Field } from "@/components/admin/admin-ui";
import { FilePicker } from "@/components/files/file-picker";
import type { FileAsset } from "@/lib/files";
import { toastError } from "@/lib/toast";
import {
  profileApi,
  type ProfileRole,
  type StudentProfile,
  type Verification,
} from "@/lib/profile";
import { primaryButton, secondaryButton } from "./styles";

export type SubmittedVerification =
  | { role: "STUDENT"; profile: StudentProfile }
  | { role: "TUTOR"; verification: Verification };

/**
 * Sends a student or tutor ID for review. A tutor needs a student ID number on the profile
 * first; the API refuses the upload without one.
 */
export function VerificationUploadDialog({
  open,
  onOpenChange,
  role,
  hasStudentIdNumber,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ProfileRole;
  hasStudentIdNumber: boolean;
  onSubmitted: (result: SubmittedVerification) => void;
}) {
  const needsIdNumberFirst = role === "TUTOR" && !hasStudentIdNumber;
  const done = () => onOpenChange(false);

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload your ID"
      description={
        role === "TUTOR"
          ? "Admins match this against your university student ID number. Only admins see the file."
          : "Admins check this against your details. Only admins see the file."
      }
    >
      {needsIdNumberFirst ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
            Add your university student ID number to your profile first. Then
            come back to upload your ID.
          </p>
          <DialogActions>
            <button type="button" onClick={done} className={secondaryButton}>
              Cancel
            </button>
            <Link
              href="/dashboard#profile"
              onClick={done}
              className={primaryButton}
            >
              Add student ID number
            </Link>
          </DialogActions>
        </div>
      ) : (
        <IdForm role={role} onSubmitted={onSubmitted} onDone={done} />
      )}
    </AdminDialog>
  );
}

function IdForm({
  role,
  onSubmitted,
  onDone,
}: {
  role: ProfileRole;
  onSubmitted: (result: SubmittedVerification) => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<FileAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    try {
      if (role === "STUDENT") {
        const profile = await profileApi.submitStudentVerification(file.id);
        onSubmitted({ role, profile });
      } else {
        const verification = await profileApi.submitTutorVerification(file.id);
        onSubmitted({ role, verification });
      }
      toast.success("ID sent for review");
      onDone();
    } catch (err) {
      toastError("Couldn't send your ID.", err);
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
      className="grid grid-cols-[minmax(0,1fr)] gap-5"
    >
      <Field label="Your ID">
        {({ id, describedBy, invalid }) => (
          <FilePicker
            purpose={role === "TUTOR" ? "TUTOR_ID" : "STUDENT_ID"}
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            value={file}
            onChange={setFile}
            onBusyChange={setUploading}
            disabled={submitting}
            chooseLabel="Choose your ID"
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
