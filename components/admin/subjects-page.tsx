"use client";

import { useState, type FormEvent } from "react";
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
  QueryState,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import {
  SORT_ORDER_MAX,
  useAdminSubjects,
  useCreateSubject,
  useUpdateSubject,
  validateSlug,
  validateSortOrder,
  validateSubjectName,
  type AdminSubject,
  type SubjectFields,
} from "@/lib/admin-subjects";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";
import { PendingLabel } from "@/components/ui/pending-label";

type DialogState = { mode: "create" } | { mode: "edit"; subject: AdminSubject };

type FieldName = "name" | "slug" | "sortOrder";

export function SubjectsPage() {
  const subjects = useAdminSubjects();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const list = subjects.data?.subjects ?? [];

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Subjects"
      description="Tutors and students pick from this list. Turning a subject off hides it from pickers; tutors who already teach it keep it."
      actions={
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className={cn(primaryButton, "min-h-11")}
        >
          Add subject
        </button>
      }
    >
      <QueryState
        query={subjects}
        isEmpty={list.length === 0}
        loadingLabel="Loading subjects"
        errorText="Couldn't load subjects."
        emptyText="No subjects yet. Add the first one."
      >
        <ul className="grid gap-4">
          {list.map((subject) => (
            <SubjectRow
              key={subject.id}
              subject={subject}
              onEdit={() => setDialog({ mode: "edit", subject })}
            />
          ))}
        </ul>
      </QueryState>

      <SubjectDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminPage>
  );
}

function SubjectRow({
  subject,
  onEdit,
}: {
  subject: AdminSubject;
  onEdit: () => void;
}) {
  const toggle = useUpdateSubject();
  const toggling = toggle.isPending && toggle.variables?.id === subject.id;

  function onToggle() {
    toggle.mutate(
      { id: subject.id, body: { isActive: !subject.isActive } },
      {
        onSuccess: () =>
          toastSuccess(
            subject.isActive ? "Subject turned off" : "Subject turned on",
          ),
        onError: (err) => toastError("Couldn't update this subject.", err),
      },
    );
  }

  return (
    <li
      className={cn(
        card,
        "flex flex-wrap items-center justify-between gap-4 p-5",
      )}
    >
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {subject.name}
          </p>
          {!subject.isActive && <StatusPill tone="neutral">Off</StatusPill>}
        </div>
        <p className="font-mono text-xs break-all text-[var(--color-text-secondary)]">
          {subject.slug}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          Order {subject.sortOrder} · {tutorsText(subject.tutorCount)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${subject.name}`}
          className={cn(secondaryButton, "min-h-11")}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          aria-busy={toggling || undefined}
          aria-label={`${subject.isActive ? "Turn off" : "Turn on"} ${subject.name}`}
          className={cn(secondaryButton, "min-h-11")}
        >
          <PendingLabel pending={toggling}>
            {subject.isActive ? "Turn off" : "Turn on"}
          </PendingLabel>
        </button>
      </div>
    </li>
  );
}

function SubjectDialog({
  state,
  onClose,
}: {
  state: DialogState | null;
  onClose: () => void;
}) {
  const create = useCreateSubject();
  const update = useUpdateSubject();
  const saving = create.isPending || update.isPending;

  function submit(
    mode: DialogState["mode"],
    subjectId: number | null,
    fields: SubjectFields,
    onError: (err: unknown) => void,
  ) {
    if (mode === "edit" && subjectId !== null) {
      update.mutate(
        { id: subjectId, body: fields },
        {
          onSuccess: () => {
            toastSuccess("Subject updated");
            onClose();
          },
          onError,
        },
      );
      return;
    }
    create.mutate(fields, {
      onSuccess: () => {
        toastSuccess("Subject added");
        onClose();
      },
      onError,
    });
  }

  return (
    <AdminDialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      busy={saving}
      title={state?.mode === "edit" ? "Edit subject" : "Add subject"}
    >
      {state && (
        <SubjectForm
          key={state.mode === "edit" ? state.subject.id : "create"}
          state={state}
          saving={saving}
          onCancel={onClose}
          onSubmit={(fields, onError) =>
            submit(
              state.mode,
              state.mode === "edit" ? state.subject.id : null,
              fields,
              onError,
            )
          }
        />
      )}
    </AdminDialog>
  );
}

function SubjectForm({
  state,
  saving,
  onCancel,
  onSubmit,
}: {
  state: DialogState;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (fields: SubjectFields, onError: (err: unknown) => void) => void;
}) {
  const subject = state.mode === "edit" ? state.subject : null;
  const [name, setName] = useState(subject?.name ?? "");
  const [slug, setSlug] = useState(subject?.slug ?? "");
  const [order, setOrder] = useState(String(subject?.sortOrder ?? 0));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});

  const clientErrors: Record<FieldName, string | undefined> = {
    name: validateSubjectName(name),
    slug: validateSlug(slug),
    sortOrder: validateSortOrder(order),
  };
  const messageFor = (field: FieldName) =>
    serverErrors[field] ?? (submitted ? clientErrors[field] : undefined);

  function clearServerError(field: FieldName) {
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (clientErrors.name || clientErrors.slug || clientErrors.sortOrder)
      return;
    const trimmedSlug = slug.trim();
    onSubmit(
      {
        name: name.trim(),
        sortOrder: Number(order.trim()),
        ...(trimmedSlug ? { slug: trimmedSlug } : {}),
      },
      (err) => {
        const issues = err instanceof ApiError ? (err.issues ?? []) : [];
        const next: Partial<Record<FieldName, string>> = {};
        for (const issue of issues) {
          const field = issue.path[0];
          if (field === "name" || field === "slug" || field === "sortOrder")
            next[field] = issue.message;
        }
        if (Object.keys(next).length > 0) setServerErrors(next);
        else toastError("Couldn't save the subject.", err);
      },
    );
  }

  return (
    <form noValidate onSubmit={onFormSubmit}>
      <div className="grid gap-4">
        <Field label="Name" error={messageFor("name")}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={name}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                clearServerError("name");
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            />
          )}
        </Field>

        <Field
          label="Slug (optional)"
          hint="Lowercase letters, numbers and dashes. Made from the name if empty."
          error={messageFor("slug")}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={slug}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setSlug(e.target.value);
                clearServerError("slug");
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "font-mono")}
            />
          )}
        </Field>

        <Field label="Order" error={messageFor("sortOrder")}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              max={SORT_ORDER_MAX}
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                clearServerError("sortOrder");
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "tabular-nums")}
            />
          )}
        </Field>
      </div>

      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className={cn(primaryButton, "min-h-11 sm:min-w-36")}
        >
          <PendingLabel pending={saving}>
            {subject ? "Save changes" : "Add subject"}
          </PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

function tutorsText(count: number): string {
  return count === 1 ? "1 tutor" : `${count} tutors`;
}
