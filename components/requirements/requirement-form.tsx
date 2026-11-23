"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TUITION_TYPES } from "@/lib/profile";
import type { EducationFields } from "@/lib/education";
import { EducationLevelPicker } from "@/components/requirements/education-level-picker";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  DaysOfWeekField,
  DaysPerWeekField,
} from "@/components/requirements/day-fields";
import {
  emptyRequirementForm,
  formatPostedDate,
  fromRequirement,
  getLocalIsoDate,
  requirementApi,
  toPayload,
  validateRequirementForm,
  type CreateRequirementBody,
  type Requirement,
  type RequirementForm as FormState,
  type RequirementFormErrors,
  type RequirementTemplateNotes,
  type TutorGenderPref,
} from "@/lib/requirements";
import { invalidateRequirements, queryKeys } from "@/lib/query-keys";
import {
  AreaPicker,
  Chip,
  control,
  FieldError,
  SubjectPicker,
} from "@/components/profile/profile-fields";
import { errorCodeMessage, mapServerIssuesToFields } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import {
  card,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";

const GENDER_OPTIONS: { value: TutorGenderPref; label: string }[] = [
  { value: "ANY", label: "Any" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

interface RequirementFormProps {
  initialData?: Requirement | null;
  defaultAreaId?: number;
  /** Form state copied from an earlier requirement ("Post again"). Creates a new one. */
  template?: FormState;
  templateNotes?: RequirementTemplateNotes;
}

export function RequirementForm({
  initialData,
  defaultAreaId,
  template,
  templateNotes,
}: RequirementFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;
  const isDraft = initialData?.status === "DRAFT";

  const [form, setForm] = useState<FormState>(() => {
    if (initialData) return fromRequirement(initialData);
    if (template) return template;
    return emptyRequirementForm(defaultAreaId);
  });
  const [errors, setErrors] = useState<RequirementFormErrors>({});
  const [savingAction, setSavingAction] = useState<
    "OPEN" | "DRAFT" | "UPDATE" | null
  >(null);

  const formRef = useRef<HTMLFormElement>(null);
  const idPrefix = useId();

  const todayIso = getLocalIsoDate();

  useEffect(() => {
    // Focus page h1 title on mount
    document.getElementById("requirement-form-title")?.focus();
  }, []);

  const queryClient = useQueryClient();
  // Prefill class and curriculum from the newest requirement, create only. A copied
  // requirement already has its own class, so it skips this.
  const mineQuery = useQuery({
    queryKey: queryKeys.requirements.mine,
    queryFn: requirementApi.mine,
    enabled: !isEdit && !template,
  });
  // Runs once, during render, when the first data arrives (no effect needed).
  const [prefillChecked, setPrefillChecked] = useState(false);
  if (!prefillChecked && !template && mineQuery.data) {
    setPrefillChecked(true);
    const newest = [...mineQuery.data].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];
    const curriculum = newest?.curriculum ?? null;
    const levelCode = newest?.levelCode ?? null;
    // Only fill when the user has not picked a level yet.
    if (curriculum !== null && levelCode !== null && form.levelCode === null) {
      setForm((f) => ({
        ...f,
        curriculum,
        levelCode,
        academicGroup: newest?.academicGroup ?? null,
      }));
    }
  }

  const updateForm = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        delete next[k as keyof FormState];
      }
      // The days-per-week fit depends on the chosen days, so drop its stale error.
      if ("availableDays" in patch) delete next.daysPerWeek;
      return next;
    });
  };

  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(
          "[aria-invalid=true]:is(input,select,textarea), [aria-invalid=true] input",
        )
        ?.focus();
    });
  };

  const handleSalaryBlur = () => {
    const raw = form.salary.replace(/\D/g, "");
    if (!raw) return;
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      updateForm({ salary: new Intl.NumberFormat("en-BD").format(num) });
    }
  };

  const handleSubmit = async (targetStatus?: "OPEN" | "DRAFT") => {
    if (savingAction) return;
    const desiredStatus =
      targetStatus ?? (isEdit && !isDraft ? "OPEN" : "OPEN");
    const foundErrors = validateRequirementForm(form, desiredStatus);
    if (desiredStatus === "DRAFT" && foundErrors.subjectIds) {
      toast.error(foundErrors.subjectIds, { id: "requirement-draft-empty" });
      return;
    }
    if (Object.keys(foundErrors).length > 0) {
      toast.error(Object.values(foundErrors)[0], {
        id: "requirement-validation",
      });
      setErrors(foundErrors);
      focusFirstInvalid();
      return;
    }

    const action = isEdit
      ? targetStatus === "OPEN"
        ? "OPEN"
        : "UPDATE"
      : (targetStatus ?? "OPEN");

    setSavingAction(action);

    try {
      const payload = toPayload(
        form,
        isEdit ? targetStatus : (targetStatus ?? "OPEN"),
      );

      if (isEdit) {
        await requirementApi.update(initialData.id, payload);
        await invalidateRequirements(queryClient);
        const queryParam = targetStatus === "OPEN" ? "posted=1" : "saved=1";
        router.push(`/dashboard?${queryParam}#requirements`);
      } else {
        // Validated above; a DRAFT or OPEN payload is a create body.
        await requirementApi.create(payload as CreateRequirementBody);
        await invalidateRequirements(queryClient);
        const queryParam = targetStatus === "DRAFT" ? "draft=1" : "posted=1";
        router.push(`/dashboard?${queryParam}#requirements`);
      }
    } catch (err: unknown) {
      setSavingAction(null);
      if (err instanceof ApiError && err.issues) {
        setErrors(mapServerIssuesToFields<keyof FormState>(err.issues));
        focusFirstInvalid();
      }
      const status = (err as { status?: number }).status;
      const message = (err as { message?: string }).message;

      if (err instanceof ApiError && err.code === "REQUIREMENT_DUPLICATE") {
        const requirementId = err.details?.requirementId;
        toast.error(
          errorCodeMessage(err) ??
            "Couldn't save requirement. Try again in a moment.",
          {
            id: "requirement-duplicate",
            description:
              typeof requirementId === "string" ? (
                <Link
                  href={`/dashboard/requirements/${requirementId}/edit`}
                  className="font-semibold underline"
                >
                  Edit the open requirement
                </Link>
              ) : undefined,
          },
        );
      } else if (
        err instanceof ApiError &&
        err.code === "PHONE_VERIFICATION_REQUIRED"
      ) {
        toast.error("Verify your phone number before posting.", {
          id: "requirement-phone-verification",
          description: (
            <Link
              href="/dashboard#phone-verification"
              className="font-semibold underline"
            >
              Go to your profile to verify it
            </Link>
          ),
        });
      } else if (status === 400) {
        toast.error(
          "One of your choices isn't available any more. Pick it again.",
        );
      } else if (status === 401) {
        router.replace("/sign-in");
      } else if (status === 404 && message?.includes("Student profile")) {
        router.replace("/onboarding");
      } else if (status === 404 && isEdit) {
        toast.error("This requirement doesn't exist or isn't yours.");
      } else if (status === 409 && isEdit) {
        toast.error(
          "This requirement is closed or has a hired tutor, so it can't be edited.",
        );
      } else {
        toast.error(
          message || "Couldn't save requirement. Try again in a moment.",
        );
      }
    }
  };

  const educationValue: EducationFields = {
    curriculum: form.curriculum,
    levelCode: form.levelCode,
    academicGroup: form.academicGroup,
    admissionTargets: form.admissionTargets,
    isRetaker: form.isRetaker,
    levelNote: form.levelNote,
  };
  const educationErrors: Partial<Record<keyof EducationFields, string>> = {
    curriculum: errors.curriculum,
    levelCode: errors.levelCode,
    academicGroup: errors.academicGroup,
    admissionTargets: errors.admissionTargets,
    isRetaker: errors.isRetaker,
    levelNote: errors.levelNote,
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(isEdit && !isDraft ? undefined : "OPEN");
      }}
      aria-busy={!!savingAction}
      className={cn(card, "mt-6 p-5 sm:p-8")}
    >
      {templateNotes && <TemplateNotice notes={templateNotes} />}

      <div className="grid gap-10">
        {/* Group 1: What you need */}
        <fieldset className="grid gap-6">
          <div>
            <legend className="text-base font-semibold text-[var(--color-neutral-charcoal)] sm:text-lg">
              What you need
            </legend>
            <p className="mt-0.5 text-sm text-pretty text-[var(--color-text-secondary)]">
              Tutors search by these.
            </p>
          </div>

          {/* Subject */}
          <div className="grid gap-2">
            <span
              id={`${idPrefix}-subject-label`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Subject
            </span>
            <SubjectPicker
              invalid={!!errors.subjectIds}
              multiple={true}
              value={form.subjectIds}
              onChange={(ids) => updateForm({ subjectIds: ids })}
            />
            <FieldError
              id={`${idPrefix}-subject-error`}
              message={errors.subjectIds}
            />
          </div>

          {/* Class, curriculum and extras */}
          <EducationLevelPicker
            idPrefix={idPrefix}
            value={educationValue}
            onChange={(next) => updateForm(next)}
            errors={educationErrors}
            classHint={
              templateNotes?.checkClass
                ? "Posted over 6 months ago. Check the class."
                : undefined
            }
          />

          {/* School or college */}
          <div className="grid gap-2">
            <label
              htmlFor={`${idPrefix}-instituteName`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              School or college
            </label>
            <input
              id={`${idPrefix}-instituteName`}
              type="text"
              value={form.instituteName}
              maxLength={200}
              placeholder="Viqarunnisa Noon School"
              aria-invalid={errors.instituteName ? true : undefined}
              aria-describedby={
                errors.instituteName
                  ? `${idPrefix}-instituteName-error`
                  : `${idPrefix}-instituteName-hint`
              }
              onChange={(e) => updateForm({ instituteName: e.target.value })}
              className={cn(control, "h-12")}
            />
            <p
              id={`${idPrefix}-instituteName-hint`}
              className="text-sm text-[var(--color-text-secondary)]"
            >
              Helps tutors who know the syllabus.
            </p>
            <FieldError
              id={`${idPrefix}-instituteName-error`}
              message={errors.instituteName}
            />
          </div>
        </fieldset>

        {/* Group 2: Where and when */}
        <fieldset className="grid gap-6">
          <div>
            <legend className="text-base font-semibold text-[var(--color-neutral-charcoal)] sm:text-lg">
              Where and when
            </legend>
            <p className="mt-0.5 text-sm text-pretty text-[var(--color-text-secondary)]">
              Your exact address stays private until you confirm a tutor.
            </p>
          </div>

          {/* Area */}
          <div className="grid gap-2">
            <span
              id={`${idPrefix}-area-label`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Area
            </span>
            <AreaPicker
              invalid={!!errors.areaId}
              multiple={false}
              value={form.areaId ? [form.areaId] : []}
              onChange={(ids) => updateForm({ areaId: ids[0] ?? null })}
            />
            <FieldError id={`${idPrefix}-area-error`} message={errors.areaId} />
          </div>

          {/* Tuition type */}
          <div className="grid gap-2">
            <span
              id={`${idPrefix}-tuitionType-label`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Tuition type
            </span>
            <div className="flex flex-wrap gap-2">
              {TUITION_TYPES.map((type) => (
                <Chip
                  key={type}
                  type="radio"
                  name={`${idPrefix}-tuitionType`}
                  label={type}
                  checked={form.tuitionType === type}
                  onChange={() => updateForm({ tuitionType: type })}
                />
              ))}
            </div>
            <FieldError
              id={`${idPrefix}-tuitionType-error`}
              message={errors.tuitionType}
            />
          </div>

          {/* Days available, then days per week & Preferred time pair */}
          <DaysOfWeekField
            idPrefix={idPrefix}
            label="Days available"
            value={form.availableDays}
            onChange={(availableDays) => updateForm({ availableDays })}
            error={errors.availableDays}
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <DaysPerWeekField
              idPrefix={idPrefix}
              value={form.daysPerWeek}
              onChange={(daysPerWeek) => updateForm({ daysPerWeek })}
              error={errors.daysPerWeek}
            />

            <div className="grid gap-2">
              <label
                htmlFor={`${idPrefix}-timeOfDay`}
                className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
              >
                Preferred time
              </label>
              <input
                id={`${idPrefix}-timeOfDay`}
                type="time"
                step="900"
                value={form.timeOfDay}
                aria-invalid={errors.timeOfDay ? true : undefined}
                aria-describedby={
                  errors.timeOfDay ? `${idPrefix}-timeOfDay-error` : undefined
                }
                onChange={(e) => updateForm({ timeOfDay: e.target.value })}
                className={cn(control, "h-12")}
              />
              <FieldError
                id={`${idPrefix}-timeOfDay-error`}
                message={errors.timeOfDay}
              />
            </div>
          </div>

          {/* Hire by date */}
          <div className="grid gap-2">
            <label
              htmlFor={`${idPrefix}-hireByDate`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Hire by date
            </label>
            <input
              id={`${idPrefix}-hireByDate`}
              type="date"
              min={todayIso}
              value={form.hireByDate}
              aria-invalid={errors.hireByDate ? true : undefined}
              aria-describedby={
                errors.hireByDate
                  ? `${idPrefix}-hireByDate-error`
                  : `${idPrefix}-hireByDate-hint`
              }
              onChange={(e) => updateForm({ hireByDate: e.target.value })}
              className={cn(control, "h-12")}
            />
            <p
              id={`${idPrefix}-hireByDate-hint`}
              className="text-sm text-[var(--color-text-secondary)]"
            >
              When you want to start.
            </p>
            <FieldError
              id={`${idPrefix}-hireByDate-error`}
              message={errors.hireByDate}
            />
          </div>
        </fieldset>

        {/* Group 3: Budget and preferences */}
        <fieldset className="grid gap-6">
          <div>
            <legend className="text-base font-semibold text-[var(--color-neutral-charcoal)] sm:text-lg">
              Budget and preferences
            </legend>
          </div>

          {/* Salary & Students pair */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <label
                htmlFor={`${idPrefix}-salary`}
                className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
              >
                Monthly salary (taka)
              </label>
              <div className="relative flex items-center">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute start-4 text-base font-semibold text-[var(--color-text-secondary)]"
                >
                  ৳
                </span>
                <input
                  id={`${idPrefix}-salary`}
                  type="text"
                  inputMode="numeric"
                  value={form.salary}
                  placeholder="8,000"
                  aria-invalid={errors.salary ? true : undefined}
                  aria-describedby={
                    errors.salary ? `${idPrefix}-salary-error` : undefined
                  }
                  onChange={(e) => updateForm({ salary: e.target.value })}
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
              <FieldError
                id={`${idPrefix}-salary-error`}
                message={errors.salary}
              />
            </div>

            <div className="grid gap-2">
              <span
                id={`${idPrefix}-students-label`}
                className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
              >
                Students
              </span>
              <div className="flex h-12 items-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease student count"
                  disabled={form.studentCount <= 1}
                  onClick={() =>
                    updateForm({
                      studentCount: Math.max(1, form.studentCount - 1),
                    })
                  }
                  className={cn(
                    secondaryButton,
                    "size-11 min-h-0 rounded-full p-0",
                  )}
                >
                  <Minus aria-hidden="true" className="size-4" />
                </button>
                <span
                  aria-live="polite"
                  className="w-8 text-center text-lg font-semibold text-[var(--color-neutral-charcoal)] tabular-nums"
                >
                  {form.studentCount}
                </span>
                <button
                  type="button"
                  aria-label="Increase student count"
                  disabled={form.studentCount >= 10}
                  onClick={() =>
                    updateForm({
                      studentCount: Math.min(10, form.studentCount + 1),
                    })
                  }
                  className={cn(
                    secondaryButton,
                    "size-11 min-h-0 rounded-full p-0",
                  )}
                >
                  <Plus aria-hidden="true" className="size-4" />
                </button>
              </div>
              <FieldError
                id={`${idPrefix}-students-error`}
                message={errors.studentCount}
              />
            </div>
          </div>

          {/* Preferred tutor gender */}
          <div className="grid gap-2">
            <span
              id={`${idPrefix}-gender-label`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Preferred tutor
            </span>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((g) => (
                <Chip
                  key={g.value}
                  type="radio"
                  name={`${idPrefix}-tutorGenderPref`}
                  label={g.label}
                  checked={form.tutorGenderPref === g.value}
                  onChange={() => updateForm({ tutorGenderPref: g.value })}
                />
              ))}
            </div>
          </div>
        </fieldset>
      </div>

      {/* Action buttons */}
      <div
        data-sticky-actions
        className="sticky bottom-0 -mx-5 mt-10 bg-white/90 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.12)] backdrop-blur-md sm:relative sm:bottom-auto sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none"
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link href="/dashboard" className={cn(ghostButton, "sm:min-w-28")}>
            <LinkPendingLabel>Cancel</LinkPendingLabel>
          </Link>

          {isEdit ? (
            isDraft ? (
              <>
                <button
                  type="button"
                  disabled={!!savingAction}
                  aria-busy={savingAction === "DRAFT" || undefined}
                  onClick={() => handleSubmit("DRAFT")}
                  className={secondaryButton}
                >
                  <PendingLabel pending={savingAction === "DRAFT"}>
                    Save changes
                  </PendingLabel>
                </button>

                <button
                  type="button"
                  disabled={!!savingAction}
                  aria-busy={savingAction === "OPEN" || undefined}
                  onClick={() => handleSubmit("OPEN")}
                  className={cn(primaryButton, "sm:min-w-40")}
                >
                  <PendingLabel pending={savingAction === "OPEN"}>
                    Save and post
                    <Check
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={2.5}
                    />
                  </PendingLabel>
                </button>
              </>
            ) : (
              <button
                type="submit"
                disabled={!!savingAction}
                aria-busy={savingAction === "UPDATE" || undefined}
                className={cn(primaryButton, "sm:min-w-40")}
              >
                <PendingLabel pending={savingAction === "UPDATE"}>
                  Save changes
                  <Check
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2.5}
                  />
                </PendingLabel>
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                disabled={!!savingAction}
                aria-busy={savingAction === "DRAFT" || undefined}
                onClick={() => handleSubmit("DRAFT")}
                className={secondaryButton}
              >
                <PendingLabel pending={savingAction === "DRAFT"}>
                  Save as draft
                </PendingLabel>
              </button>

              <button
                type="button"
                disabled={!!savingAction}
                aria-busy={savingAction === "OPEN" || undefined}
                onClick={() => handleSubmit("OPEN")}
                className={cn(primaryButton, "sm:min-w-44")}
              >
                <PendingLabel pending={savingAction === "OPEN"}>
                  Post requirement
                  <Check
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2.5}
                  />
                </PendingLabel>
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function TemplateNotice({ notes }: { notes: RequirementTemplateNotes }) {
  const lines: string[] = [];
  if (notes.removedSubjects > 0) {
    lines.push(
      notes.removedSubjects === 1
        ? "Removed 1 subject that's no longer offered."
        : `Removed ${notes.removedSubjects} subjects that are no longer offered.`,
    );
  }
  if (notes.areaCleared) {
    lines.push("Pick the area again. The old one is no longer available.");
  }
  if (notes.tuitionTypeReset) {
    lines.push("Pick the tuition type again.");
  }

  return (
    <div
      role="status"
      className="mb-8 rounded-[16px] bg-[var(--color-secondary-sky)] p-4 text-sm text-[var(--color-primary-deep)]"
    >
      <p className="font-semibold text-pretty">
        {`Copied from your requirement posted on ${formatPostedDate(notes.postedOn)}. Check the class, time and salary before posting.`}
      </p>
      {lines.map((line) => (
        <p key={line} className="mt-1 text-pretty">
          {line}
        </p>
      ))}
    </div>
  );
}
