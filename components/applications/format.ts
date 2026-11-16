import { groupsFor, levelLabel, type EducationLookup } from "@/lib/education";
import { AREAS, SUBJECTS, optionName } from "@/lib/profile";
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
  const rows = [
    { label: "Subjects", value: subjectNames(target.subjectIds) },
    { label: "Level", value: levelText(lookup, target) ?? "" },
    { label: "Area", value: areaName(target.areaId) },
    { label: "Salary", value: salaryText(target.salary) ?? "" },
    {
      label: "Days per week",
      value: target.daysPerWeek === null ? "" : String(target.daysPerWeek),
    },
    { label: "Time", value: formatTime(target.timeOfDay) },
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
