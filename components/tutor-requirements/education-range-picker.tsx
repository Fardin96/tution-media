"use client";

import { cn } from "@/lib/utils";
import { Chip, control, FieldError } from "@/components/profile/profile-fields";
import { secondaryButton } from "@/components/profile/styles";
import {
  levelOptionsFor,
  reconcileCoverage,
  showsTargets,
  useEducationLookup,
  type AcademicGroup,
  type AdmissionTarget,
  type Curriculum,
} from "@/lib/education";
import type {
  TutorRequirementForm,
  TutorRequirementFormErrors,
} from "@/lib/tutor-requirements";

const labelClass = "text-sm font-semibold text-[var(--color-neutral-charcoal)]";
const revealClass =
  "transition-[opacity,translate] duration-150 ease-out starting:opacity-0 starting:translate-y-1 motion-reduce:transition-none";

export type EducationRangeValue = Pick<
  TutorRequirementForm,
  "levelMin" | "levelMax" | "curricula" | "academicGroups" | "admissionTargets"
>;

interface EducationRangePickerProps {
  idPrefix: string;
  value: EducationRangeValue;
  onChange: (next: EducationRangeValue) => void;
  errors: TutorRequirementFormErrors;
}

function parseLevel(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

export function EducationRangePicker({
  idPrefix,
  value,
  onChange,
  errors,
}: EducationRangePickerProps) {
  const query = useEducationLookup();
  const lookup = query.data;

  if (!lookup) {
    if (query.isError) {
      return (
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
      );
    }

    return (
      <div aria-busy="true" className="grid min-w-0 gap-2">
        <div aria-hidden="true" className="grid gap-2">
          <div className="h-11 rounded-[12px] bg-[var(--color-surface-subtle)]" />
          <div className="h-12 rounded-[12px] bg-[var(--color-surface-subtle)]" />
        </div>
      </div>
    );
  }

  // Every change passes through reconcileCoverage, which mirrors the server rules.
  const update = (next: EducationRangeValue) =>
    onChange(reconcileCoverage(lookup, next));

  const hasCurricula = value.curricula.length > 0;
  const allChosen =
    lookup.curricula.length > 0 &&
    lookup.curricula.every((c) => value.curricula.includes(c.code));
  const levelOptions = levelOptionsFor(lookup, value.curricula);
  const chosen = lookup.curricula.filter((c) =>
    value.curricula.includes(c.code),
  );

  // Groups: the union of the chosen curricula's groups, labelled by the first curriculum that offers each code.
  const groupOptions: { code: AcademicGroup; label: string }[] = [];
  for (const c of chosen) {
    for (const g of c.groups) {
      if (!groupOptions.some((o) => o.code === g.code)) groupOptions.push(g);
    }
  }
  const overlapsGroups =
    value.levelMin !== null &&
    value.levelMax !== null &&
    value.levelMin <= lookup.groupLevels.max &&
    value.levelMax >= lookup.groupLevels.min;
  const showGroups = overlapsGroups && groupOptions.length > 0;
  const showTargets = showsTargets(lookup, value.levelMax);

  const setCurricula = (curricula: Curriculum[]) => {
    const offered = new Set(
      levelOptionsFor(lookup, curricula).map((o) => o.code),
    );
    update({
      ...value,
      curricula,
      levelMin:
        value.levelMin !== null && offered.has(value.levelMin)
          ? value.levelMin
          : null,
      levelMax:
        value.levelMax !== null && offered.has(value.levelMax)
          ? value.levelMax
          : null,
    });
  };

  const toggleCurriculum = (code: Curriculum) =>
    setCurricula(
      value.curricula.includes(code)
        ? value.curricula.filter((c) => c !== code)
        : [...value.curricula, code],
    );

  const toggleAll = () =>
    setCurricula(allChosen ? [] : lookup.curricula.map((c) => c.code));

  const toggleGroup = (code: AcademicGroup) =>
    update({
      ...value,
      academicGroups: value.academicGroups.includes(code)
        ? value.academicGroups.filter((g) => g !== code)
        : [...value.academicGroups, code],
    });

  const toggleTarget = (code: AdmissionTarget) =>
    update({
      ...value,
      admissionTargets: value.admissionTargets.includes(code)
        ? value.admissionTargets.filter((t) => t !== code)
        : [...value.admissionTargets, code],
    });

  const curriculaLabelId = `${idPrefix}-curricula-label`;
  const curriculaErrorId = `${idPrefix}-curricula-error`;
  const levelMinErrorId = `${idPrefix}-levelMin-error`;
  const levelMaxErrorId = `${idPrefix}-levelMax-error`;
  const groupsLabelId = `${idPrefix}-groups-label`;
  const groupsErrorId = `${idPrefix}-academicGroups-error`;
  const targetsLabelId = `${idPrefix}-targets-label`;
  const targetsErrorId = `${idPrefix}-admissionTargets-error`;

  return (
    <div className="grid min-w-0 gap-5">
      {/* Curricula */}
      <div className="grid gap-2">
        <span id={curriculaLabelId} className={labelClass}>
          Curricula
        </span>
        <div
          role="group"
          aria-labelledby={curriculaLabelId}
          aria-describedby={errors.curricula ? curriculaErrorId : undefined}
          className="flex flex-wrap gap-2"
        >
          <Chip
            type="checkbox"
            name={`${idPrefix}-curricula`}
            label="All"
            checked={allChosen}
            onChange={toggleAll}
          />
          {lookup.curricula.map((c) => (
            <Chip
              key={c.code}
              type="checkbox"
              name={`${idPrefix}-curricula`}
              label={c.label}
              checked={value.curricula.includes(c.code)}
              onChange={() => toggleCurriculum(c.code)}
            />
          ))}
        </div>
        <FieldError id={curriculaErrorId} message={errors.curricula} />
      </div>

      {/* From and To */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor={`${idPrefix}-levelMin`} className={labelClass}>
            From
          </label>
          <select
            id={`${idPrefix}-levelMin`}
            value={value.levelMin === null ? "" : String(value.levelMin)}
            disabled={!hasCurricula}
            aria-invalid={errors.levelMin ? true : undefined}
            aria-describedby={errors.levelMin ? levelMinErrorId : undefined}
            onChange={(e) =>
              update({ ...value, levelMin: parseLevel(e.target.value) })
            }
            className={cn(control, "h-12 bg-[var(--color-neutral-white)]")}
          >
            <option value="" disabled>
              Lowest class
            </option>
            {levelOptions.map((o) => (
              <option key={o.code} value={String(o.code)}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError id={levelMinErrorId} message={errors.levelMin} />
        </div>

        <div className="grid gap-2">
          <label htmlFor={`${idPrefix}-levelMax`} className={labelClass}>
            To
          </label>
          <select
            id={`${idPrefix}-levelMax`}
            value={value.levelMax === null ? "" : String(value.levelMax)}
            disabled={!hasCurricula}
            aria-invalid={errors.levelMax ? true : undefined}
            aria-describedby={errors.levelMax ? levelMaxErrorId : undefined}
            onChange={(e) =>
              update({ ...value, levelMax: parseLevel(e.target.value) })
            }
            className={cn(control, "h-12 bg-[var(--color-neutral-white)]")}
          >
            <option value="" disabled>
              Highest class
            </option>
            {levelOptions.map((o) => (
              <option key={o.code} value={String(o.code)}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError id={levelMaxErrorId} message={errors.levelMax} />
        </div>
      </div>

      {/* Groups, only when the range reaches 9-12 */}
      {showGroups && (
        <div className={cn("grid gap-2", revealClass)}>
          <span id={groupsLabelId} className={labelClass}>
            Groups (optional, none means any)
          </span>
          <div
            role="group"
            aria-labelledby={groupsLabelId}
            aria-describedby={errors.academicGroups ? groupsErrorId : undefined}
            className="flex flex-wrap gap-2"
          >
            {groupOptions.map((g) => (
              <Chip
                key={g.code}
                type="checkbox"
                name={`${idPrefix}-academicGroups`}
                label={g.label}
                checked={value.academicGroups.includes(g.code)}
                onChange={() => toggleGroup(g.code)}
              />
            ))}
          </div>
          <FieldError id={groupsErrorId} message={errors.academicGroups} />
        </div>
      )}

      {/* Admission targets, only when the range tops out at admission */}
      {showTargets && (
        <div className={cn("grid gap-2", revealClass)}>
          <span id={targetsLabelId} className={labelClass}>
            Admission targets (optional, none means any)
          </span>
          <div
            role="group"
            aria-labelledby={targetsLabelId}
            aria-describedby={
              errors.admissionTargets ? targetsErrorId : undefined
            }
            className="flex flex-wrap gap-2"
          >
            {lookup.admissionTargets.map((t) => (
              <span key={t.code} title={t.covers}>
                <Chip
                  type="checkbox"
                  name={`${idPrefix}-admissionTargets`}
                  label={t.label}
                  checked={value.admissionTargets.includes(t.code)}
                  onChange={() => toggleTarget(t.code)}
                />
              </span>
            ))}
          </div>
          <FieldError id={targetsErrorId} message={errors.admissionTargets} />
        </div>
      )}
    </div>
  );
}
