"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AREAS,
  SUBJECTS,
  formatBdPhone,
  optionName,
  validate,
  type FieldDef,
  type FormErrors,
  type ProfileForm,
  type Section,
} from "@/lib/profile";
import { FieldError, ProfileFields } from "./profile-fields";
import { card, ghostButton, primaryButton, secondaryButton } from "./styles";

const GENDER_LABEL = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

export function EditSection({
  section,
  values,
  onSave,
}: {
  section: Section;
  values: ProfileForm;
  onSave: (next: ProfileForm, fields: FieldDef[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = `section-${section.id}`;

  useEffect(() => {
    if (editing)
      formRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, [editing]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  const start = () => {
    setDraft(values);
    setErrors({});
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  };

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => editRef.current?.focus());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(section.fields, draft);
    if (Object.keys(found).length) {
      setErrors(found);
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>(
            "[aria-invalid=true]:is(input,textarea), [aria-invalid=true] input",
          )
          ?.focus(),
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft, section.fields);
      setSaved(true);
      close();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className={cn(card, "p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3
            id={titleId}
            className="text-base font-semibold text-[var(--color-neutral-charcoal)] sm:text-lg"
          >
            {section.title}
          </h3>
          <p className="mt-0.5 text-sm text-pretty text-[var(--color-text-secondary)]">
            {section.description}
          </p>
        </div>
        {!editing && (
          <button
            ref={editRef}
            type="button"
            onClick={start}
            className={cn(ghostButton, "-mt-1 -mr-2 shrink-0")}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit<span className="sr-only"> {section.title.toLowerCase()}</span>
          </button>
        )}
      </div>

      <p aria-live="polite" className="empty:hidden">
        {saved && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-semantic-success-surface)] px-3 py-1 text-sm font-medium text-[var(--color-semantic-success-text)]">
            <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
            Changes saved
          </span>
        )}
      </p>

      {editing ? (
        <form
          ref={formRef}
          noValidate
          onSubmit={submit}
          onKeyDown={(e) => e.key === "Escape" && !saving && close()}
          aria-busy={saving}
          className="mt-6"
        >
          <ProfileFields
            fields={section.fields}
            form={draft}
            errors={errors}
            onChange={(patch) => {
              setDraft((d) => ({ ...d, ...patch }));
              setErrors((e) => {
                const next = { ...e };
                for (const k of Object.keys(patch))
                  delete next[k as keyof ProfileForm];
                return next;
              });
            }}
          />
          {saveError && (
            <div
              role="alert"
              className="mt-6 rounded-[12px] bg-[var(--color-semantic-error-surface)] px-4 py-3"
            >
              <FieldError message={saveError} />
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving && (
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              )}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {section.fields.map((f) => (
            <div
              key={f.key}
              className={cn(
                "min-w-0",
                (f.kind === "textarea" ||
                  f.kind === "address" ||
                  f.kind === "areas" ||
                  f.kind === "subjects") &&
                  "sm:col-span-2",
              )}
            >
              <dt className="text-sm text-[var(--color-text-secondary)]">
                {f.label}
              </dt>
              <dd className="mt-1 text-base font-medium break-words text-[var(--color-neutral-charcoal)]">
                <Value field={f} values={values} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Value({ field, values }: { field: FieldDef; values: ProfileForm }) {
  const empty = (
    <span className="font-normal text-[var(--color-text-secondary)]">
      Not added
    </span>
  );
  switch (field.kind) {
    case "tel":
      return values[field.key]
        ? formatBdPhone(values[field.key] as string)
        : empty;
    case "gender":
      return values.gender ? GENDER_LABEL[values.gender] : empty;
    case "area":
      return values.areaIds[0] ? optionName(AREAS, values.areaIds[0]) : empty;
    case "areas":
    case "subjects": {
      const ids = field.kind === "areas" ? values.areaIds : values.subjectIds;
      const list = field.kind === "areas" ? AREAS : SUBJECTS;
      if (!ids.length) return empty;
      return (
        <ul className="mt-1 flex flex-wrap gap-2">
          {ids.map((id) => (
            <li
              key={id}
              className="rounded-full bg-[var(--color-secondary-sky)] px-3 py-1 text-sm font-medium text-[var(--color-primary-deep)]"
            >
              {optionName(list, id)}
            </li>
          ))}
        </ul>
      );
    }
    default:
      return (values[field.key] as string) || empty;
  }
}
