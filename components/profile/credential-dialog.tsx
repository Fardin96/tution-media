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
import { PendingLabel } from "@/components/ui/pending-label";
import type { FileAsset } from "@/lib/files";
import { toastError } from "@/lib/toast";
import { profileApi, type Credential } from "@/lib/profile";
import { validateCredentialForm } from "@/lib/upload-forms";
import { primaryButton, secondaryButton } from "./styles";

export function CredentialDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (credential: Credential) => void;
}) {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add credential"
      description="A result sheet or certificate from SSC, HSC or university."
    >
      <CredentialForm onAdded={onAdded} onDone={() => onOpenChange(false)} />
    </AdminDialog>
  );
}

function CredentialForm({
  onAdded,
  onDone,
}: {
  onAdded: (credential: Credential) => void;
  onDone: () => void;
}) {
  const [examLabel, setExamLabel] = useState("");
  const [result, setResult] = useState("");
  const [file, setFile] = useState<FileAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Errors show after the first submit attempt, then update as the user types.
  const [submitted, setSubmitted] = useState(false);

  const values = { examLabel, result, fileId: file?.id ?? null };
  const errors = submitted ? validateCredentialForm(values) : {};

  const submit = async () => {
    if (submitting) return;
    setSubmitted(true);
    if (Object.keys(validateCredentialForm(values)).length > 0 || !file) return;
    setSubmitting(true);
    try {
      const credential = await profileApi.addCredential({
        examLabel: examLabel.trim(),
        result: result.trim(),
        fileId: file.id,
      });
      toast.success("Credential added");
      onAdded(credential);
      onDone();
    } catch (err) {
      toastError("Couldn't add the credential.", err);
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
      <Field
        label="Exam"
        hint="Like SSC 2024 or HSC 2025."
        error={errors.examLabel}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={examLabel}
            onChange={(event) => setExamLabel(event.target.value)}
            maxLength={80}
            autoComplete="off"
            disabled={submitting}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </Field>
      <Field label="Result" hint="Like GPA 5.00 or A+." error={errors.result}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={result}
            onChange={(event) => setResult(event.target.value)}
            maxLength={40}
            autoComplete="off"
            disabled={submitting}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </Field>
      <Field label="Result sheet" error={errors.fileId}>
        {({ id, describedBy, invalid }) => (
          <FilePicker
            purpose="CREDENTIAL"
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            value={file}
            onChange={setFile}
            onBusyChange={setUploading}
            disabled={submitting}
            chooseLabel="Choose a file"
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
          aria-busy={submitting || undefined}
          className={primaryButton}
        >
          <PendingLabel pending={submitting}>Add credential</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}
