"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { ApiError } from "@/lib/profile";
import { ERROR_CODES, mapServerIssuesToFields } from "@/lib/api-errors";
import { queryKeys } from "@/lib/query-keys";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  packageMissing,
  usePackageReadiness,
  useCreatePackage,
  useUpdatePackage,
  type MyPackage,
} from "@/lib/packages";
import {
  DESCRIPTION_MAX,
  DURATION_MAX,
  DURATION_MIN,
  PackageForm as FormState,
  STUDENTS_MAX,
  STUDENTS_MIN,
  TITLE_MAX,
  emptyPackageForm,
  fromMyPackage,
  toCreatePackagePayload,
  toPackagePatch,
  validatePackageForm,
  type PackageFormErrors,
} from "@/lib/package-form";
import {
  newProfileSubjects,
  useProfileSubjects,
} from "@/lib/tutor-requirements";
import { Chip, control, FieldError } from "@/components/profile/profile-fields";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { ReadinessChecklist } from "@/components/profile/readiness-checklist";
import {
  DaysOfWeekField,
  DaysPerWeekField,
} from "@/components/requirements/day-fields";
import { EducationRangePicker } from "@/components/tutor-requirements/education-range-picker";
import { SetSubjectPicker } from "@/components/tutor-requirements/set-subject-picker";
import { ZonePicker } from "@/components/tutor-requirements/zone-picker";

const LIST_HREF = "/dashboard/tutor/packages";
const legendClass =
  "text-base font-semibold text-[var(--color-neutral-charcoal)] sm:text-lg";
const labelClass = "text-sm font-semibold text-[var(--color-neutral-charcoal)]";
const hintClass = "text-sm text-[var(--color-text-secondary)]";
const blockedClass =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:shadow-none aria-disabled:hover:bg-[var(--color-primary-core)] aria-disabled:active:scale-100";

/** Server field names that have an input on this form. Anything else stays out of the way. */
const FORM_FIELDS = new Set<string>(Object.keys(emptyPackageForm()));

/** Inline copy for an INVALID_REQUIREMENT that names the field. */
const REQUIREMENT_FIELD_MESSAGES: Record<string, string> = {
  subjectIds: "Choose subjects from the list.",
  zoneIds: "Pick only zones you've added.",
};

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export type PackageFormProps =
  { mode: "create" } | { mode: "edit"; initial: MyPackage };

export function PackageForm(props: PackageFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initial = props.mode === "edit" ? props.initial : null;
  const isEdit = initial !== null;

  const [form, setForm] = useState<FormState>(() =>
    initial ? fromMyPackage(initial) : emptyPackageForm(),
  );
  const [errors, setErrors] = useState<PackageFormErrors>({});
  const [saving, setSaving] = useState(false);
  // Gaps a 403 reported on publish. Kept only until the account data refreshes.
  const [serverGate, setServerGate] = useState<{
    missing: string[];
    at: number;
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const idPrefix = useId();

  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage(initial?.id ?? "");

  const profileQuery = useProfileSubjects();
  const profileSubjects = profileQuery.data ?? [];
  const profileIds = profileSubjects.map((o) => o.id);

  const readiness = usePackageReadiness();
  const readinessMissing = packageMissing(
    readiness.data?.applyReadiness?.missing ?? [],
  );
  const gate =
    serverGate && serverGate.at === readiness.dataUpdatedAt
      ? serverGate.missing
      : null;
  // Editing an open package has no profile gate, so only create shows the checklist.
  const missing = isEdit ? [] : (gate ?? readinessMissing);
  const blocked = missing.length > 0;
  const blockedId = `${idPrefix}-blocked`;

  const updateForm = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        delete next[k as keyof FormState];
      }
      // The days-per-week fit depends on the chosen days, and the zone rule on online teaching.
      if ("availableDays" in patch) delete next.daysPerWeek;
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

  const handlePriceBlur = () => {
    const raw = form.price.replace(/\D/g, "");
    if (!raw) return;
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      updateForm({ price: new Intl.NumberFormat("en-BD").format(num) });
    }
  };

  const handleSaveError = (err: unknown) => {
    if (err instanceof ApiError && err.code === ERROR_CODES.ProfileIncomplete) {
      setServerGate({
        missing: packageMissing(stringList(err.details?.missing)),
        at: readiness.dataUpdatedAt,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast.error("Finish your profile to publish.");
      return;
    }

    const mapped: PackageFormErrors = {};
    if (err instanceof ApiError) {
      if (err.code === ERROR_CODES.InvalidRequirement) {
        for (const field of stringList(err.details?.fields)) {
          const message = REQUIREMENT_FIELD_MESSAGES[field];
          if (message) mapped[field as keyof FormState] = message;
        }
      }
      const fromIssues = mapServerIssuesToFields<keyof FormState>(err.issues);
      for (const [field, message] of Object.entries(fromIssues)) {
        if (FORM_FIELDS.has(field) && message) {
          mapped[field as keyof FormState] ??= message;
        }
      }
    }

    if (Object.keys(mapped).length > 0) {
      setErrors(mapped);
      focusFirstInvalid();
      return;
    }
    toastError("Couldn't save this package. Try again.", err);
  };

  const handleSubmit = async () => {
    if (blocked || saving) return;

    const found = validatePackageForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstInvalid();
      return;
    }

    setSaving(true);
    try {
      if (initial) {
        const patch = toPackagePatch(initial, form, profileIds);
        if (Object.keys(patch).length === 0) {
          toastSuccess("No changes to save.");
          router.push(LIST_HREF);
          return;
        }
        // Saving a rejected package resubmits it for review.
        const wasRejected = initial.moderationStatus === "REJECTED";
        await updatePackage.mutateAsync(patch);
        toastSuccess(
          wasRejected ? "Package sent for review again" : "Changes saved.",
        );
      } else {
        await createPackage.mutateAsync(
          toCreatePackagePayload(form, profileIds),
        );
        toastSuccess("Package sent for review");
      }

      if (newProfileSubjects(form.subjectIds, profileIds).length > 0) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.tutor.profileSubjects,
        });
      }
      router.push(LIST_HREF);
    } catch (err: unknown) {
      setSaving(false);
      handleSaveError(err);
    }
  };

  const descriptionId = `${idPrefix}-description`;
  const descriptionCounterId = `${idPrefix}-description-count`;

  return (
    <div className="mt-6 grid gap-6">
      {missing.length > 0 && <ReadinessChecklist missing={missing} />}

      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        aria-busy={saving}
        className={cn(card, "p-5 sm:p-8")}
      >
        <div className="grid gap-10">
          {/* Group 1: About this package */}
          <fieldset className="grid min-w-0 gap-6">
            <legend className={legendClass}>About this package</legend>

            <div className="grid gap-2">
              <label htmlFor={`${idPrefix}-title`} className={labelClass}>
                Title
              </label>
              <input
                id={`${idPrefix}-title`}
                type="text"
                value={form.title}
                maxLength={TITLE_MAX}
                placeholder="SSC Math Booster"
                autoComplete="off"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={
                  errors.title ? `${idPrefix}-title-error` : undefined
                }
                onChange={(e) => updateForm({ title: e.target.value })}
                className={cn(control, "h-12")}
              />
              <FieldError
                id={`${idPrefix}-title-error`}
                message={errors.title}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor={descriptionId} className={labelClass}>
                What it covers
              </label>
              <textarea
                id={descriptionId}
                rows={4}
                value={form.description}
                maxLength={DESCRIPTION_MAX}
                placeholder="Full syllabus revision with weekly mock tests and past papers."
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={
                  errors.description
                    ? `${idPrefix}-description-error ${descriptionCounterId}`
                    : descriptionCounterId
                }
                onChange={(e) => updateForm({ description: e.target.value })}
                className={cn(control, "min-h-28 py-3 leading-relaxed")}
              />
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <FieldError
                  id={`${idPrefix}-description-error`}
                  message={errors.description}
                />
                <p
                  id={descriptionCounterId}
                  className={cn(hintClass, "ms-auto tabular-nums")}
                >
                  {`${form.description.length} / ${DESCRIPTION_MAX}`}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <span id={`${idPrefix}-coverage-label`} className={labelClass}>
                Coverage
              </span>
              <div
                role="radiogroup"
                aria-labelledby={`${idPrefix}-coverage-label`}
                className="flex flex-wrap gap-2"
              >
                <Chip
                  type="radio"
                  name={`${idPrefix}-coverage`}
                  label="Full curriculum"
                  checked={form.coverage === "FULL_CURRICULUM"}
                  onChange={() => updateForm({ coverage: "FULL_CURRICULUM" })}
                />
                <Chip
                  type="radio"
                  name={`${idPrefix}-coverage`}
                  label="Part of the curriculum"
                  checked={form.coverage === "PARTIAL"}
                  onChange={() => updateForm({ coverage: "PARTIAL" })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label
                htmlFor={`${idPrefix}-durationWeeks`}
                className={labelClass}
              >
                Duration (weeks)
              </label>
              <div className="relative flex items-center">
                <input
                  id={`${idPrefix}-durationWeeks`}
                  type="number"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  inputMode="numeric"
                  value={form.durationWeeks ?? ""}
                  aria-invalid={errors.durationWeeks ? true : undefined}
                  aria-describedby={
                    errors.durationWeeks
                      ? `${idPrefix}-durationWeeks-error`
                      : undefined
                  }
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    updateForm({
                      durationWeeks: Number.isNaN(n) ? null : n,
                    });
                  }}
                  className={cn(control, "h-12 pe-20 tabular-nums")}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute end-4 text-sm text-[var(--color-text-secondary)]"
                >
                  weeks
                </span>
              </div>
              <FieldError
                id={`${idPrefix}-durationWeeks-error`}
                message={errors.durationWeeks}
              />
            </div>
          </fieldset>

          {/* Group 2: Subjects */}
          <fieldset className="grid min-w-0 gap-6">
            <legend className={legendClass}>Subjects</legend>
            <SetSubjectPicker
              idPrefix={idPrefix}
              profileSubjects={profileSubjects}
              value={form.subjectIds}
              onChange={(ids) => updateForm({ subjectIds: ids })}
              error={errors.subjectIds}
            />
          </fieldset>

          {/* Group 3: Classes you teach */}
          <fieldset className="grid min-w-0 gap-6">
            <legend className={legendClass}>Classes you teach</legend>
            <EducationRangePicker
              idPrefix={idPrefix}
              value={form}
              onChange={(next) => updateForm(next)}
              errors={errors}
            />
          </fieldset>

          {/* Group 4: When */}
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
              <label
                htmlFor={`${idPrefix}-availableFrom`}
                className={labelClass}
              >
                Available from
              </label>
              <input
                id={`${idPrefix}-availableFrom`}
                type="date"
                value={form.availableFrom}
                aria-invalid={errors.availableFrom ? true : undefined}
                aria-describedby={
                  errors.availableFrom
                    ? `${idPrefix}-availableFrom-error`
                    : undefined
                }
                onChange={(e) => updateForm({ availableFrom: e.target.value })}
                className={cn(control, "h-12")}
              />
              <FieldError
                id={`${idPrefix}-availableFrom-error`}
                message={errors.availableFrom}
              />
            </div>
          </fieldset>

          {/* Group 5: Students and price */}
          <fieldset className="grid min-w-0 gap-6">
            <legend className={legendClass}>Students and price</legend>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid content-start gap-2">
                <label
                  htmlFor={`${idPrefix}-maxStudents`}
                  className={labelClass}
                >
                  Max students
                </label>
                <input
                  id={`${idPrefix}-maxStudents`}
                  type="number"
                  min={STUDENTS_MIN}
                  max={STUDENTS_MAX}
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

              <div className="grid content-start gap-2">
                <label htmlFor={`${idPrefix}-price`} className={labelClass}>
                  Price for the whole package (taka)
                </label>
                <div className="relative flex items-center">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute start-4 text-base font-semibold text-[var(--color-text-secondary)]"
                  >
                    ৳
                  </span>
                  <input
                    id={`${idPrefix}-price`}
                    type="text"
                    inputMode="numeric"
                    value={form.price}
                    placeholder="15,000"
                    aria-invalid={errors.price ? true : undefined}
                    aria-describedby={
                      errors.price
                        ? `${idPrefix}-price-error`
                        : `${idPrefix}-price-hint`
                    }
                    onChange={(e) => updateForm({ price: e.target.value })}
                    onBlur={handlePriceBlur}
                    className={cn(control, "h-12 ps-9 tabular-nums")}
                  />
                </div>
                <p id={`${idPrefix}-price-hint`} className={hintClass}>
                  Students pay this for the full package. The platform fee is a
                  percentage of it.
                </p>
                <FieldError
                  id={`${idPrefix}-price-error`}
                  message={errors.price}
                />
              </div>
            </div>
          </fieldset>

          {/* Group 6: Where */}
          <fieldset className="grid min-w-0 gap-6">
            <legend className={legendClass}>Where</legend>

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

            <div className="grid gap-3">
              <ZonePicker
                idPrefix={idPrefix}
                value={form.zoneIds}
                onChange={(ids) => updateForm({ zoneIds: ids })}
                teachesOnline={form.teachesOnline}
                emptyHint={
                  // The inline error says the same thing once the form is submitted.
                  errors.zoneIds
                    ? ""
                    : "Pick at least one zone or turn on online teaching."
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
            </div>
          </fieldset>
        </div>

        {/* Action buttons */}
        <div
          data-sticky-actions
          className="sticky bottom-0 -mx-5 mt-10 bg-white/90 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.12)] backdrop-blur-md sm:relative sm:bottom-auto sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none"
        >
          <div className="grid gap-3">
            {blocked && (
              <p
                id={blockedId}
                className="text-sm font-medium text-[var(--color-text-secondary)] sm:text-end"
              >
                Finish your profile first.
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Link href={LIST_HREF} className={secondaryButton}>
                <LinkPendingLabel>Cancel</LinkPendingLabel>
              </Link>

              <button
                type="submit"
                aria-disabled={blocked || undefined}
                aria-describedby={blocked ? blockedId : undefined}
                aria-busy={saving || undefined}
                disabled={saving || profileQuery.isPending}
                className={cn(primaryButton, "sm:min-w-44", blockedClass)}
              >
                <PendingLabel pending={saving}>
                  {isEdit ? "Save changes" : "Publish package"}
                  <Check
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2.5}
                  />
                </PendingLabel>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
