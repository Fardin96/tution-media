"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { AutoHeight } from "@/components/motion/auto-height";
import { swapMotion } from "@/components/motion/swap";
import { PendingLabel } from "@/components/ui/pending-label";
import { useAreas } from "@/lib/areas";
import { useSubjects } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import {
  conflictField,
  formatBdPhone,
  normalizeBdPhone,
  optionName,
  validate,
  type FieldDef,
  type FormErrors,
  type ProfileForm,
  type Section,
} from "@/lib/profile";
import { ProfileFields } from "./profile-fields";
import { card, ghostButton, primaryButton, secondaryButton } from "./styles";

const GENDER_LABEL = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

/** Thrown by onSave when the user backs out of a save (e.g. a cancelled confirm). Keeps the section open without a toast. */
export class SaveCancelled extends Error {}

export function EditSection({
  section,
  values,
  onSave,
  verifiedPhone = null,
  phoneLocked = false,
  onVerifyNumber,
}: {
  section: Section;
  values: ProfileForm;
  onSave: (next: ProfileForm, fields: FieldDef[]) => Promise<void>;
  /** The profile's verified number (E.164), or null. Editing it away means verifying the new one. */
  verifiedPhone?: string | null;
  /** The role requires a verified phone: the number changes only through verification. */
  phoneLocked?: boolean;
  onVerifyNumber?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  // The address lookup holds Save until it settles, so a pin's district can't be saved late.
  const [addressBusy, setAddressBusy] = useState(false);
  const swap = swapMotion(useReducedMotion());
  const editRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = `section-${section.id}`;
  const hasPhone = section.fields.some((f) => f.key === "phoneNumber");
  const lockPhone = phoneLocked && hasPhone;
  const changesVerifiedPhone =
    !lockPhone &&
    !!verifiedPhone &&
    hasPhone &&
    normalizeBdPhone(draft.phoneNumber) !== verifiedPhone;

  useEffect(() => {
    if (editing)
      formRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, [editing]);

  const start = () => {
    setDraft(values);
    setErrors({});
    setEditing(true);
  };

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => editRef.current?.focus());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || addressBusy) return;
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
    try {
      await onSave(draft, section.fields);
      toast.success("Changes saved");
      close();
    } catch (err) {
      if (err instanceof SaveCancelled) return;
      const field = conflictField(err);
      if (field) setErrors({ [field]: (err as Error).message });
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
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

      {/* The details and the form swap in place while the card's height follows. */}
      <AutoHeight>
        <AnimatePresence mode="popLayout" initial={false}>
          {editing ? (
            <motion.form
              key="edit"
              {...swap}
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
                onBusyChange={setAddressBusy}
                locked={
                  lockPhone
                    ? {
                        key: "phoneNumber",
                        hint: "To change it, verify the new number.",
                        action: onVerifyNumber && (
                          <button
                            type="button"
                            onClick={onVerifyNumber}
                            className={cn(
                              secondaryButton,
                              "min-h-10 justify-self-start px-4",
                            )}
                          >
                            Change number
                          </button>
                        ),
                      }
                    : undefined
                }
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
              {changesVerifiedPhone && (
                <p className="mt-4 text-sm text-pretty text-[var(--color-semantic-warning-text)]">
                  This is a new number. It won&apos;t count as verified until
                  you confirm it with a code.
                </p>
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
                <button
                  type="submit"
                  disabled={saving || addressBusy}
                  aria-busy={saving || undefined}
                  className={primaryButton}
                >
                  <PendingLabel pending={saving}>Save changes</PendingLabel>
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.dl
              key="view"
              {...swap}
              className="mt-5 grid w-full gap-x-6 gap-y-5 sm:grid-cols-2"
            >
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
            </motion.dl>
          )}
        </AnimatePresence>
      </AutoHeight>
    </section>
  );
}

function Value({ field, values }: { field: FieldDef; values: ProfileForm }) {
  const { subjects } = useSubjects();
  const { areas } = useAreas();
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
      return values.areaIds[0] ? optionName(areas, values.areaIds[0]) : empty;
    case "areas":
    case "subjects": {
      const ids = field.kind === "areas" ? values.areaIds : values.subjectIds;
      const list = field.kind === "areas" ? areas : subjects;
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
