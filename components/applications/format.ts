import {
  combinedLevelLabel,
  curriculumOf,
  groupsFor,
  levelLabel,
  type AcademicGroup,
  type AdmissionTarget,
  type Curriculum,
  type EducationLookup,
} from "@/lib/education";
import { AREAS, SUBJECTS, optionName } from "@/lib/profile";
import { durationLabel } from "@/lib/packages";
import { formatTaka, formatTime } from "@/lib/requirements";
import type { Application } from "@/lib/applications";

export type ApplicationTarget = Application["target"];

const DAY_FORMAT = new Intl.DateTimeFormat("en-BD", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/** "12 Nov 2026" in Dhaka time. Accepts ISO date-times and YYYY-MM-DD. */
export function formatDay(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DAY_FORMAT.format(date);
}

export function subjectNames(ids: number[]): string {
  return ids.map((id) => optionName(SUBJECTS, id)).join(" · ");
}

export function areaName(areaId: number | null): string {
  return areaId === null ? "Online" : optionName(AREAS, areaId);
}

/** Packages carry no area on the application, so only requirements show one. */
export function areaText(target: ApplicationTarget): string | null {
  return target.kind === "PACKAGE" ? null : areaName(target.areaId);
}

/** A package is listed by its title; a requirement keeps the other party's name. */
export function headingText(
  target: ApplicationTarget,
  counterpartName: string,
): string {
  return target.kind === "PACKAGE" && target.title
    ? target.title
    : counterpartName;
}

/** "Class 9 · Science" style label, or null when the target has no level. */
export function levelText(
  lookup: EducationLookup | undefined,
  target: ApplicationTarget,
): string | null {
  if (target.levelCode === null) return null;
  const label =
    levelLabel(lookup, target.curriculum, target.levelCode) ??
    `Level ${target.levelCode}`;
  const group = groupsFor(lookup, target.curriculum, target.levelCode).find(
    (g) => g.code === target.academicGroup,
  );
  return group ? `${label} · ${group.label}` : label;
}

export function salaryText(salary: number | null): string | null {
  if (salary === null) return null;
  return `${formatTaka(salary)} a month`;
}

/** "৳15,000 total" for a package, "৳5,000 a month" for a requirement's salary. */
export function moneyText(target: ApplicationTarget): string | null {
  if (target.kind === "PACKAGE") {
    return target.price === null ? null : `${formatTaka(target.price)} total`;
  }
  return salaryText(target.salary);
}

/** "12 weeks" for a package; requirements have no duration. */
export function durationText(target: ApplicationTarget): string | null {
  return target.durationWeeks === null
    ? null
    : durationLabel(target.durationWeeks);
}

export function scheduleText(target: ApplicationTarget): string | null {
  const parts: string[] = [];
  if (target.daysPerWeek !== null) {
    parts.push(
      target.daysPerWeek === 1
        ? "1 day a week"
        : `${target.daysPerWeek} days a week`,
    );
  }
  const time = formatTime(target.timeOfDay);
  if (time) parts.push(time);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Label/value rows for the detail page's Tuition section. Empty values are dropped. */
export function targetRows(
  lookup: EducationLookup | undefined,
  target: ApplicationTarget,
): { label: string; value: string }[] {
  const isPackage = target.kind === "PACKAGE";
  const rows = [
    { label: "Subjects", value: subjectNames(target.subjectIds) },
    { label: "Level", value: levelText(lookup, target) ?? "" },
    { label: "Area", value: areaText(target) ?? "" },
    { label: isPackage ? "Price" : "Salary", value: moneyText(target) ?? "" },
    { label: "Duration", value: durationText(target) ?? "" },
    {
      label: "Days per week",
      value: target.daysPerWeek === null ? "" : String(target.daysPerWeek),
    },
    {
      label: isPackage ? "Start time" : "Time",
      value: formatTime(target.timeOfDay),
    },
  ];
  return rows.filter((row) => row.value !== "");
}

export function ratingText(ratingAvg: number, ratingCount: number): string {
  return `${ratingAvg.toFixed(1)} (${ratingCount})`;
}

export function genderLabel(gender: "MALE" | "FEMALE" | "OTHER"): string {
  switch (gender) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    default:
      return "Other";
  }
}

/** WhatsApp click-to-chat needs digits only, with the country code. */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

/** An application is closed for the counterpart once the target is taken and this one did not win. */
export function showsClosedNote(application: Application): boolean {
  return (
    application.target.closed &&
    application.status !== "CONFIRMED" &&
    application.status !== "COMPLETED"
  );
}

/** Level range across the set's curricula, e.g. "Pre-school to Class 9". Level 0 and negatives are valid. */
export function educationRangeText(
  lookup: EducationLookup | undefined,
  curricula: Curriculum[],
  levelMin: number,
  levelMax: number,
): string {
  const label = (level: number) =>
    combinedLevelLabel(lookup, curricula, level) || `Level ${level}`;
  return levelMin === levelMax
    ? label(levelMin)
    : `${label(levelMin)} to ${label(levelMax)}`;
}

/** "Bangla medium · English version", or "All curricula" when the set covers every one. */
export function curriculaText(
  lookup: EducationLookup | undefined,
  curricula: Curriculum[],
): string {
  if (
    lookup &&
    curricula.length > 0 &&
    curricula.length === lookup.curricula.length
  ) {
    return "All curricula";
  }
  return curricula
    .map((c) => curriculumOf(lookup, c)?.label)
    .filter((label): label is string => Boolean(label))
    .join(" · ");
}

/** "Science · Business". Group labels live under each curriculum in the lookup. */
export function groupNamesText(
  lookup: EducationLookup | undefined,
  codes: AcademicGroup[],
): string {
  return codes
    .map(
      (code) =>
        lookup?.curricula.flatMap((c) => c.groups).find((g) => g.code === code)
          ?.label,
    )
    .filter((label): label is string => Boolean(label))
    .join(" · ");
}

/** Admission target labels, e.g. "Engineering · Medical". */
export function admissionNamesText(
  lookup: EducationLookup | undefined,
  codes: AdmissionTarget[],
): string {
  return codes
    .map((code) => lookup?.admissionTargets.find((t) => t.code === code)?.label)
    .filter((label): label is string => Boolean(label))
    .join(" · ");
}

export function minSalaryText(salary: number | null): string {
  return salary === null ? "Any" : `${formatTaka(salary)} a month`;
}

export function studentsText(count: number): string {
  return count === 1 ? "1 student" : `${count} students`;
}
