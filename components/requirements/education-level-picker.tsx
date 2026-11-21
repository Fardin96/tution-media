"use client";

import { cn } from "@/lib/utils";
import { Chip, control, FieldError } from "@/components/profile/profile-fields";
import { secondaryButton } from "@/components/profile/styles";
import {
  curriculumOf,
  groupsFor,
  reconcileEducation,
  retakerLabel,
  showsTargets,
  useEducationLookup,
  type AcademicGroup,
  type EducationFields,
} from "@/lib/education";

const labelClass = "text-sm font-semibold text-[var(--color-neutral-charcoal)]";
const hintClass = "text-sm text-[var(--color-text-secondary)]";
const revealClass =
  "transition-[opacity,translate] duration-150 ease-out starting:opacity-0 starting:translate-y-1 motion-reduce:transition-none";

const ADMISSION_HINT =
  "Admission & test prep is for the goal, not the student's age: a Grade 11 student preparing for the SAT picks it.";
const NOTE_HINT = "Shown to tutors only. It isn't used for matching.";

function describedBy(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

interface EducationLevelPickerProps {
  idPrefix: string;
  value: EducationFields;
  onChange: (next: EducationFields) => void;
  errors: Partial<Record<keyof EducationFields, string>>;
  /** Extra hint under the class picker, linked to it. */
  classHint?: string;
}

export function EducationLevelPicker({
  idPrefix,
  value,
  onChange,
  errors,
  classHint,
}: EducationLevelPickerProps) {
  const query = useEducationLookup();
  const lookup = query.data;

  const legend = (
    <legend className={cn(labelClass, "mb-3")}>Class and curriculum</legend>
  );

  if (!lookup) {
    if (query.isError) {
      return (
        <fieldset className="grid min-w-0 gap-5">
          {legend}
          <div className="grid gap-3">
            <p className="text-sm font-medium text-[var(--color-semantic-error-text)]">
              {"Couldn't load class options."}
            </p>
            <div>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className={secondaryButton}
              >
                Try again
              </button>
            </div>
          </div>
        </fieldset>
      );
    }

    return (
      <fieldset aria-busy="true" className="grid min-w-0 gap-5">
        {legend}
        <div aria-hidden="true" className="grid gap-2">
          <div className="h-11 rounded-[12px] bg-[var(--color-surface-subtle)]" />
          <div className="h-12 rounded-[12px] bg-[var(--color-surface-subtle)]" />
        </div>
      </fieldset>
    );
  }

  const update = (next: EducationFields) =>
    onChange(reconcileEducation(lookup, next));

  const curriculum = curriculumOf(lookup, value.curriculum);
  const groups = groupsFor(lookup, value.curriculum, value.levelCode);
  const targetsOn = showsTargets(lookup, value.levelCode);
  const retaker = retakerLabel(lookup, value.levelCode);
  const offersAdmission =
    curriculum?.levels.some((l) => l.code === lookup.admissionLevel) ?? false;
  const selectedCovers = lookup.admissionTargets
    .filter((t) => value.admissionTargets.includes(t.code))
    .map((t) => t.covers)
    .join(" · ");

  const curriculumLabelId = `${idPrefix}-curriculum-label`;
  const levelHintId = `${idPrefix}-level-hint`;
  const classHintId = `${idPrefix}-class-hint`;
  const levelErrorId = `${idPrefix}-levelCode-error`;

  return (
    <fieldset className="grid min-w-0 gap-5">
      {legend}

      {/* Step 1: curriculum */}
      <div className="grid gap-2">
        <span id={curriculumLabelId} className={labelClass}>
          Curriculum
        </span>
        <div
          role="radiogroup"
          aria-labelledby={curriculumLabelId}
          aria-invalid={errors.curriculum ? true : undefined}
          aria-describedby={describedBy(
            errors.curriculum && `${idPrefix}-curriculum-error`,
          )}
          className="flex flex-wrap gap-2"
        >
          {lookup.curricula.map((c) => (
            <Chip
              key={c.code}
              type="radio"
              name={`${idPrefix}-curriculum`}
              label={c.label}
              checked={value.curriculum === c.code}
              onChange={() => update({ ...value, curriculum: c.code })}
            />
          ))}
        </div>
        <FieldError
          id={`${idPrefix}-curriculum-error`}
          message={errors.curriculum}
        />
      </div>

      {/* Step 2: level */}
      <div className="grid gap-2">
        <label htmlFor={`${idPrefix}-level`} className={labelClass}>
          Class
        </label>
        <select
          id={`${idPrefix}-level`}
          value={value.levelCode === null ? "" : String(value.levelCode)}
          disabled={!curriculum}
          aria-invalid={errors.levelCode ? true : undefined}
          aria-describedby={describedBy(
            classHint && classHintId,
            offersAdmission && levelHintId,
            errors.levelCode && levelErrorId,
          )}
          onChange={(e) =>
            update({
              ...value,
              levelCode: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={cn(control, "h-12 bg-[var(--color-neutral-white)]")}
        >
          <option value="" disabled={!curriculum}>
            {curriculum ? "Choose a class" : "Choose a curriculum first"}
          </option>
          {curriculum?.levels.map((l) => (
            <option key={l.code} value={String(l.code)}>
              {l.label}
            </option>
          ))}
        </select>
        {classHint && (
          <p id={classHintId} className={hintClass}>
            {classHint}
          </p>
        )}
        {offersAdmission && (
          <p id={levelHintId} className={hintClass}>
            {ADMISSION_HINT}
          </p>
        )}
        <FieldError id={levelErrorId} message={errors.levelCode} />
      </div>

      {/* Step 3: extras, each only when it applies */}
      {groups.length > 0 && (
        <GroupStep
          idPrefix={idPrefix}
          groups={groups}
          value={value}
          errors={errors}
          onSelect={(academicGroup) => update({ ...value, academicGroup })}
        />
      )}

      {targetsOn && (
        <div className={cn("grid gap-2", revealClass)}>
          <span id={`${idPrefix}-targets-label`} className={labelClass}>
            Preparing for (optional)
          </span>
          <div
            role="group"
            aria-labelledby={`${idPrefix}-targets-label`}
            aria-describedby={describedBy(
              errors.admissionTargets && `${idPrefix}-admissionTargets-error`,
              selectedCovers && `${idPrefix}-covers-hint`,
            )}
            className="flex flex-wrap gap-2"
          >
            {lookup.admissionTargets.map((t) => {
              const checked = value.admissionTargets.includes(t.code);
              return (
                <span key={t.code} title={t.covers}>
                  <Chip
                    type="checkbox"
                    name={`${idPrefix}-admissionTargets`}
                    label={t.label}
                    checked={checked}
                    onChange={() =>
                      update({
                        ...value,
                        admissionTargets: checked
                          ? value.admissionTargets.filter((c) => c !== t.code)
                          : [...value.admissionTargets, t.code],
                      })
                    }
                  />
                </span>
              );
            })}
          </div>
          {selectedCovers && (
            <p id={`${idPrefix}-covers-hint`} className={hintClass}>
              {`Covers: ${selectedCovers}`}
            </p>
          )}
          <FieldError
            id={`${idPrefix}-admissionTargets-error`}
            message={errors.admissionTargets}
          />
        </div>
      )}

      {retaker !== undefined && (
        <div className={cn("grid gap-2", revealClass)}>
          <div className="flex flex-wrap gap-2">
            <Chip
              type="checkbox"
              name={`${idPrefix}-isRetaker`}
              label={retaker}
              checked={value.isRetaker}
              onChange={() => update({ ...value, isRetaker: !value.isRetaker })}
            />
          </div>
          <FieldError
            id={`${idPrefix}-isRetaker-error`}
            message={errors.isRetaker}
          />
        </div>
      )}

      {value.levelCode !== null && (
        <div className={cn("grid gap-2", revealClass)}>
          <label htmlFor={`${idPrefix}-levelNote`} className={labelClass}>
            Note for tutors (optional)
          </label>
          <input
            id={`${idPrefix}-levelNote`}
            type="text"
            autoComplete="off"
            value={value.levelNote}
            maxLength={lookup.levelNoteMaxLength}
            aria-invalid={errors.levelNote ? true : undefined}
            aria-describedby={describedBy(
              `${idPrefix}-levelNote-hint`,
              errors.levelNote && `${idPrefix}-levelNote-error`,
            )}
            onChange={(e) => onChange({ ...value, levelNote: e.target.value })}
            className={cn(control, "h-12")}
          />
          <div className="flex items-start justify-between gap-3">
            <p id={`${idPrefix}-levelNote-hint`} className={hintClass}>
              {NOTE_HINT}
            </p>
            <p
              aria-live="polite"
              className={cn(hintClass, "shrink-0 tabular-nums")}
            >
              {`${value.levelNote.length}/${lookup.levelNoteMaxLength}`}
            </p>
          </div>
          <FieldError
            id={`${idPrefix}-levelNote-error`}
            message={errors.levelNote}
          />
        </div>
      )}
    </fieldset>
  );
}

function GroupStep({
  idPrefix,
  groups,
  value,
  errors,
  onSelect,
}: {
  idPrefix: string;
  groups: { code: AcademicGroup; label: string }[];
  value: EducationFields;
  errors: Partial<Record<keyof EducationFields, string>>;
  onSelect: (academicGroup: AcademicGroup | null) => void;
}) {
  const labelId = `${idPrefix}-group-label`;
  return (
    <div className={cn("grid gap-2", revealClass)}>
      <span id={labelId} className={labelClass}>
        Group (optional)
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-invalid={errors.academicGroup ? true : undefined}
        aria-describedby={describedBy(
          errors.academicGroup && `${idPrefix}-academicGroup-error`,
        )}
        className="flex flex-wrap gap-2"
      >
        <Chip
          type="radio"
          name={`${idPrefix}-academicGroup`}
          label="No group"
          checked={value.academicGroup === null}
          onChange={() => onSelect(null)}
        />
        {groups.map((g) => (
          <Chip
            key={g.code}
            type="radio"
            name={`${idPrefix}-academicGroup`}
            label={g.label}
            checked={value.academicGroup === g.code}
            onChange={() => onSelect(g.code)}
          />
        ))}
      </div>
      <FieldError
        id={`${idPrefix}-academicGroup-error`}
        message={errors.academicGroup}
      />
    </div>
  );
}
