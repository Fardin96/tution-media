"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { ApiError, useMeAccount } from "@/lib/profile";
import { mapServerIssuesToFields } from "@/lib/api-errors";
import { invalidateTutorRequirements, queryKeys } from "@/lib/query-keys";
import { toastError, toastSuccess } from "@/lib/toast";
import { draftKey, useRestoredDraft } from "@/lib/form-draft";
import { DraftRestoredNotice } from "@/components/ui/draft-restored-notice";
import { useSubjects } from "@/lib/subjects";
import { getLocalIsoDate } from "@/lib/requirements";
import { useTutorZones } from "@/lib/tutor-zones";
import {
  emptyTutorRequirementForm,
  fromTutorRequirement,
  newProfileSubjects,
  toCreatePayload,
  toPatch,
  tutorRequirementApi,
  useProfileSubjects,
  validateTutorRequirementForm,
  ZONE_RULE_MESSAGE,
  type TutorRequirement,
  type TutorRequirementForm as FormState,
  type TutorRequirementFormErrors,
} from "@/lib/tutor-requirements";
import { Chip, control, FieldError } from "@/components/profile/profile-fields";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  DaysOfWeekField,
  DaysPerWeekField,
} from "@/components/requirements/day-fields";
import { EducationRangePicker } from "@/components/tutor-requirements/education-range-picker";
import { SetSubjectPicker } from "@/components/tutor-requirements/set-subject-picker";
import { ZonePicker } from "@/components/tutor-requirements/zone-picker";

const LIST_HREF = "/dashboard/tutor/requirements";
const legendClass =
  "text-base font-semibold text-[var(--color-neutral-charcoal)] sm:text-lg";
const labelClass = "text-sm font-semibold text-[var(--color-neutral-charcoal)]";
const hintClass = "text-sm text-[var(--color-text-secondary)]";

interface TutorRequirementFormProps {
  initialData?: TutorRequirement;
}

/** Drops subjects and zones that are no longer on the profile, and a start date that has passed. */
function sanitizeDraft(
  value: FormState,
  subjectIds: number[] | null,
  zoneIds: string[] | null,
): FormState {
  // A list that failed to load can't check its picks, so they are kept (null means not checked).
  const kept = <T,>(ids: T[] | null, id: T) => ids === null || ids.includes(id);
  return {
    ...value,
    subjectIds: value.subjectIds.filter((id) => kept(subjectIds, id)),
    zoneIds: value.zoneIds.filter((id) => kept(zoneIds, id)),
    availableFrom:
      value.availableFrom < getLocalIsoDate()
        ? emptyTutorRequirementForm().availableFrom
        : value.availableFrom,
  };
}

export function TutorRequirementForm({
  initialData,
}: TutorRequirementFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [start] = useState<FormState>(() =>
    initialData
      ? fromTutorRequirement(initialData)
      : emptyTutorRequirementForm(),
  );
  const [form, setForm] = useState<FormState>(start);
  const [baseline] = useState<FormState>(start);
  // An existing set that breaks the zone rule shows why straight away.
  const [errors, setErrors] = useState<TutorRequirementFormErrors>(() =>
    initialData &&
    !initialData.teachesOnline &&
    initialData.zoneIds.length === 0
      ? { zoneIds: ZONE_RULE_MESSAGE }
      : {},
  );
  const [saving, setSaving] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const idPrefix = useId();

  const profileQuery = useProfileSubjects();
  const profileSubjects = profileQuery.data ?? [];
  const profileIds = useMemo(
    () => (profileQuery.data ?? []).map((o) => o.id),
    [profileQuery.data],
  );

  const me = useMeAccount();
  const zonesQuery = useTutorZones();
  // null when the list failed to load: the picks are kept rather than dropped.
  const zoneIds = useMemo(
    () =>
      zonesQuery.isSuccess
        ? (zonesQuery.data?.zones ?? []).map((z) => z.id)
        : null,
    [zonesQuery.isSuccess, zonesQuery.data],
  );
  // The full active subject list, not the profile's: a subject picked from search is a valid pick.
  const subjectsQuery = useSubjects();
  const allSubjectIds = useMemo(
    () =>
      subjectsQuery.isSuccess ? subjectsQuery.subjects.map((s) => s.id) : null,
    [subjectsQuery.isSuccess, subjectsQuery.subjects],
  );
  const { restoredAt, startOver, clear } = useRestoredDraft<FormState>({
    key: initialData ? null : draftKey(me.data?.id, "tutor-requirement"),
    form,
    setForm,
    baseline,
    // Settled means fetched, failed or not: a list that never loads must not hold saving forever.
    ready: subjectsQuery.isFetched && zonesQuery.isFetched,
    sanitize: (saved) => sanitizeDraft(saved, allSubjectIds, zoneIds),
    fresh: emptyTutorRequirementForm(),
    focusId: "requirement-form-title",
  });

  useEffect(() => {
    // Focus page h1 title on mount
    document.getElementById("requirement-form-title")?.focus();
  }, []);

  const updateForm = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        delete next[k as keyof FormState];
      }
      // The days-per-week fit depends on the chosen days, so drop its stale error.
      if ("availableDays" in patch) delete next.daysPerWeek;
      // Teaching online satisfies the zone rule, so drop its stale error.
      if ("teachesOnline" in patch) delete next.zoneIds;
      return next;
    });
  };

  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(
          "[aria-invalid=true]:is(input,select,textarea), [aria-invalid=true] input, [data-field-error]",
        )
        ?.focus();
    });
  };

  const handleSalaryBlur = () => {
    const raw = form.minSalary.replace(/\D/g, "");
    if (!raw) return;
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      updateForm({ minSalary: new Intl.NumberFormat("en-BD").format(num) });
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    const found = validateTutorRequirementForm(form);
    const firstError = Object.values(found)[0];
    if (firstError) {
      setErrors(found);
      toastError(firstError);
      focusFirstInvalid();
      return;
    }

    setSaving(true);
    try {
      if (initialData) {
        const patch = toPatch(initialData, form, profileIds);
        if (Object.keys(patch).length === 0) {
          toastSuccess("No changes to save.");
          router.push(LIST_HREF);
          return;
        }
        await tutorRequirementApi.update(initialData.id, patch);
      } else {
        await tutorRequirementApi.create(toCreatePayload(form, profileIds));
      }

      await invalidateTutorRequirements(queryClient);
      if (newProfileSubjects(form.subjectIds, profileIds).length > 0) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.tutor.profileSubjects,
        });
      }
      if (!initialData) clear();
      toastSuccess(initialData ? "Set saved." : "Set created.");
      router.push(LIST_HREF);
    } catch (err: unknown) {
      setSaving(false);
      if (err instanceof ApiError && err.issues) {
        setErrors(mapServerIssuesToFields<keyof FormState>(err.issues));
        focusFirstInvalid();
      } else if (
        err instanceof ApiError &&
        err.code === "INVALID_REQUIREMENT" &&
        Array.isArray(err.details?.fields) &&
        err.details.fields.includes("zoneIds")
      ) {
        setErrors({ zoneIds: err.message });
        focusFirstInvalid();
      }
      toastError("Couldn't save this set. Try again.", err);
    }
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      aria-busy={saving}
      className={cn(card, "mt-6 p-5 sm:p-8")}
    >
      {restoredAt !== null && (
        <DraftRestoredNotice savedAt={restoredAt} onStartOver={startOver} />
      )}
      <div className="grid gap-10">
        {/* Group 1: About this set */}
        <fieldset className="grid min-w-0 gap-6">
          <legend className={legendClass}>About this set</legend>

          <div className="grid gap-2">
            <label htmlFor={`${idPrefix}-name`} className={labelClass}>
              Set name
            </label>
            <input
              id={`${idPrefix}-name`}
              type="text"
              value={form.name}
              maxLength={60}
              placeholder="Evening Math, Mirpur"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={
                errors.name ? `${idPrefix}-name-error` : `${idPrefix}-name-hint`
              }
              onChange={(e) => updateForm({ name: e.target.value })}
              className={cn(control, "h-12")}
            />
            <p id={`${idPrefix}-name-hint`} className={hintClass}>
              Only you see this name.
            </p>
            <FieldError id={`${idPrefix}-name-error`} message={errors.name} />
          </div>

          <SetSubjectPicker
            idPrefix={idPrefix}
            profileSubjects={profileSubjects}
            value={form.subjectIds}
            onChange={(ids) => updateForm({ subjectIds: ids })}
            error={errors.subjectIds}
          />
        </fieldset>

        {/* Group 2: Classes you teach */}
        <fieldset className="grid min-w-0 gap-6">
          <legend className={legendClass}>Classes you teach</legend>
          <EducationRangePicker
            idPrefix={idPrefix}
            value={form}
            onChange={(next) => updateForm(next)}
            errors={errors}
          />
        </fieldset>

        {/* Group 3: When */}
        <fieldset className="grid min-w-0 gap-6">
          <legend className={legendClass}>When</legend>

          <div className="flex flex-wrap gap-6">
            <div className="grid min-w-0 flex-1 basis-40 gap-2">
              <label htmlFor={`${idPrefix}-timeFrom`} className={labelClass}>
                Start time
              </label>
              <input
                id={`${idPrefix}-timeFrom`}
                type="time"
                value={form.timeFrom}
                onChange={(e) => updateForm({ timeFrom: e.target.value })}
                className={cn(control, "h-12")}
              />
            </div>
            <div className="grid min-w-0 flex-1 basis-40 gap-2">
              <label htmlFor={`${idPrefix}-timeTo`} className={labelClass}>
                End time
              </label>
              <input
                id={`${idPrefix}-timeTo`}
                type="time"
                value={form.timeTo}
                aria-invalid={errors.timeTo ? true : undefined}
                aria-describedby={
                  errors.timeTo ? `${idPrefix}-timeTo-error` : undefined
                }
                onChange={(e) => updateForm({ timeTo: e.target.value })}
                className={cn(control, "h-12")}
              />
              <FieldError
                id={`${idPrefix}-timeTo-error`}
                message={errors.timeTo}
              />
            </div>
          </div>

          <DaysOfWeekField
            idPrefix={idPrefix}
            value={form.availableDays}
            onChange={(availableDays) => updateForm({ availableDays })}
            error={errors.availableDays}
          />

          <DaysPerWeekField
            idPrefix={idPrefix}
            value={form.daysPerWeek}
            onChange={(daysPerWeek) => updateForm({ daysPerWeek })}
            error={errors.daysPerWeek}
          />

          <div className="grid gap-2">
            <label htmlFor={`${idPrefix}-availableFrom`} className={labelClass}>
              Available from
            </label>
            <input
              id={`${idPrefix}-availableFrom`}
              type="date"
              value={form.availableFrom}
              onChange={(e) => updateForm({ availableFrom: e.target.value })}
              className={cn(control, "h-12")}
            />
          </div>
        </fieldset>

        {/* Group 4: Students and pay */}
        <fieldset className="grid min-w-0 gap-6">
          <legend className={legendClass}>Students and pay</legend>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor={`${idPrefix}-maxStudents`} className={labelClass}>
                Max students
              </label>
              <input
                id={`${idPrefix}-maxStudents`}
                type="number"
                min={1}
                inputMode="numeric"
                value={form.maxStudents}
                aria-invalid={errors.maxStudents ? true : undefined}
                aria-describedby={
                  errors.maxStudents
                    ? `${idPrefix}-maxStudents-error`
                    : undefined
                }
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  updateForm({ maxStudents: Number.isNaN(n) ? 0 : n });
                }}
                className={cn(control, "h-12 tabular-nums")}
              />
              <FieldError
                id={`${idPrefix}-maxStudents-error`}
                message={errors.maxStudents}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor={`${idPrefix}-minSalary`} className={labelClass}>
                Minimum monthly salary (taka)
              </label>
              <div className="relative flex items-center">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute start-4 text-base font-semibold text-[var(--color-text-secondary)]"
                >
                  ৳
                </span>
                <input
                  id={`${idPrefix}-minSalary`}
                  type="text"
                  inputMode="numeric"
                  value={form.minSalary}
                  placeholder="8,000"
                  aria-invalid={errors.minSalary ? true : undefined}
                  aria-describedby={
                    errors.minSalary
                      ? `${idPrefix}-minSalary-error`
                      : `${idPrefix}-minSalary-hint`
                  }
                  onChange={(e) => updateForm({ minSalary: e.target.value })}
                  onBlur={handleSalaryBlur}
                  className={cn(control, "h-12 ps-9 pe-20 tabular-nums")}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute end-4 text-sm text-[var(--color-text-secondary)]"
                >
                  / month
                </span>
              </div>
              <p id={`${idPrefix}-minSalary-hint`} className={hintClass}>
                Leave empty for no minimum.
              </p>
              <FieldError
                id={`${idPrefix}-minSalary-error`}
                message={errors.minSalary}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip
              type="checkbox"
              name={`${idPrefix}-teachesOnline`}
              label="I also teach online"
              checked={form.teachesOnline}
              onChange={() =>
                updateForm({ teachesOnline: !form.teachesOnline })
              }
            />
          </div>
        </fieldset>

        {/* Group 5: Zones */}
        <fieldset className="grid min-w-0 gap-6">
          <legend className={legendClass}>Zones</legend>
          <ZonePicker
            idPrefix={idPrefix}
            value={form.zoneIds}
            onChange={(ids) => updateForm({ zoneIds: ids })}
            teachesOnline={form.teachesOnline}
            returnTo={
              initialData
                ? undefined
                : {
                    path: "/dashboard/tutor/requirements/new",
                    label: "new requirement set",
                  }
            }
            emptyHint={
              // The inline error says the same thing once the form is submitted.
              errors.zoneIds ? "" : undefined
            }
          />
          {errors.zoneIds && (
            <div data-field-error tabIndex={-1} className="outline-none">
              <FieldError
                id={`${idPrefix}-zoneIds-error`}
                message={errors.zoneIds}
              />
            </div>
          )}
        </fieldset>
      </div>

      {/* Action buttons */}
      <div
        data-sticky-actions
        className="sticky bottom-0 -mx-5 mt-10 bg-white/90 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.12)] backdrop-blur-md sm:relative sm:bottom-auto sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none"
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link href={LIST_HREF} className={secondaryButton}>
            <LinkPendingLabel>Cancel</LinkPendingLabel>
          </Link>

          <button
            type="submit"
            disabled={saving || profileQuery.isPending}
            aria-busy={saving || undefined}
            className={cn(primaryButton, "sm:min-w-44")}
          >
            <PendingLabel pending={saving}>
              {isEdit ? "Save changes" : "Create set"}
              <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
            </PendingLabel>
          </button>
        </div>
      </div>
    </form>
  );
}
