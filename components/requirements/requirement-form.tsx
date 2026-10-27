"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CATEGORIES, CLASS_LEVELS, TUITION_TYPES } from "@/lib/profile";
import {
  emptyRequirementForm,
  fromRequirement,
  getLocalIsoDate,
  requirementApi,
  toPayload,
  validateRequirementForm,
  type Requirement,
  type RequirementForm as FormState,
  type RequirementFormErrors,
  type TutorGenderPref,
} from "@/lib/requirements";
import {
  AreaPicker,
  Chip,
  ChipGroup,
  control,
  FieldError,
  SubjectPicker,
} from "@/components/profile/profile-fields";
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
}

export function RequirementForm({
  initialData,
  defaultAreaId,
}: RequirementFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;
  const isDraft = initialData?.status === "DRAFT";

  const [form, setForm] = useState<FormState>(() =>
    initialData
      ? fromRequirement(initialData)
      : emptyRequirementForm(defaultAreaId),
  );
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

  const updateForm = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        delete next[k as keyof FormState];
      }
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
        const queryParam = targetStatus === "OPEN" ? "posted=1" : "saved=1";
        router.push(`/dashboard?${queryParam}#requirements`);
      } else {
        await requirementApi.create(payload);
        const queryParam = targetStatus === "DRAFT" ? "draft=1" : "posted=1";
        router.push(`/dashboard?${queryParam}#requirements`);
      }
    } catch (err: unknown) {
      setSavingAction(null);
      const status = (err as { status?: number }).status;
      const message = (err as { message?: string }).message;

      if (status === 400) {
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
        toast.error("This requirement is closed, so it can't be edited.");
      } else {
        toast.error(
          message || "Couldn't save requirement. Try again in a moment.",
        );
      }
    }
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

          {/* Class / level */}
          <div className="grid gap-2">
            <label
              htmlFor={`${idPrefix}-classLevel`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Class / level
            </label>
            <select
              id={`${idPrefix}-classLevel`}
              value={form.classLevel ?? ""}
              aria-invalid={errors.classLevel ? true : undefined}
              aria-describedby={
                errors.classLevel ? `${idPrefix}-classLevel-error` : undefined
              }
              onChange={(e) =>
                updateForm({
                  classLevel: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={cn(control, "h-12 bg-[var(--color-neutral-white)]")}
            >
              <option value="">Choose a class</option>
              {CLASS_LEVELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <FieldError
              id={`${idPrefix}-classLevel-error`}
              message={errors.classLevel}
            />
          </div>

          {/* Curriculum (Category) */}
          <div className="grid gap-2">
            <span
              id={`${idPrefix}-category-label`}
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Curriculum (category)
            </span>
            <ChipGroup
              name={`${idPrefix}-category`}
              options={CATEGORIES}
              value={form.categoryId ? [form.categoryId] : []}
              multiple={false}
              onChange={(ids) => updateForm({ categoryId: ids[0] ?? null })}
            />
            <FieldError
              id={`${idPrefix}-category-error`}
              message={errors.categoryId}
            />
          </div>

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

          {/* Days per week & Preferred time pair */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <span
                id={`${idPrefix}-days-label`}
                className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
              >
                Days per week
              </span>
              <div
                role="radiogroup"
                aria-label="Days per week"
                aria-labelledby={`${idPrefix}-days-label`}
                className="flex items-center gap-1 rounded-full bg-[var(--color-surface-subtle)] p-1"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={form.daysPerWeek === d}
                    onClick={() => updateForm({ daysPerWeek: d })}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)]",
                      form.daysPerWeek === d
                        ? "bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] shadow-xs"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-neutral-charcoal)]",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                {form.daysPerWeek} {form.daysPerWeek === 1 ? "day" : "days"} a
                week
              </p>
              <FieldError
                id={`${idPrefix}-days-error`}
                message={errors.daysPerWeek}
              />
            </div>

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
      <div className="sticky bottom-0 -mx-5 mt-10 bg-white/90 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.12)] backdrop-blur-md sm:relative sm:bottom-auto sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link href="/dashboard" className={cn(ghostButton, "sm:min-w-28")}>
            Cancel
          </Link>

          {isEdit ? (
            isDraft ? (
              <>
                <button
                  type="button"
                  disabled={!!savingAction}
                  onClick={() => handleSubmit("DRAFT")}
                  className={secondaryButton}
                >
                  {savingAction === "DRAFT" ? (
                    <>
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin motion-reduce:animate-none"
                      />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>

                <button
                  type="button"
                  disabled={!!savingAction}
                  onClick={() => handleSubmit("OPEN")}
                  className={cn(primaryButton, "sm:min-w-40")}
                >
                  {savingAction === "OPEN" ? (
                    <>
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin motion-reduce:animate-none"
                      />
                      Posting…
                    </>
                  ) : (
                    <>
                      Save and post
                      <Check
                        aria-hidden="true"
                        className="size-4"
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="submit"
                disabled={!!savingAction}
                className={cn(primaryButton, "sm:min-w-40")}
              >
                {savingAction === "UPDATE" ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Saving…
                  </>
                ) : (
                  <>
                    Save changes
                    <Check
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                disabled={!!savingAction}
                onClick={() => handleSubmit("DRAFT")}
                className={secondaryButton}
              >
                {savingAction === "DRAFT" ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Saving…
                  </>
                ) : (
                  "Save as draft"
                )}
              </button>

              <button
                type="button"
                disabled={!!savingAction}
                onClick={() => handleSubmit("OPEN")}
                className={cn(primaryButton, "sm:min-w-44")}
              >
                {savingAction === "OPEN" ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Posting…
                  </>
                ) : (
                  <>
                    Post requirement
                    <Check
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
