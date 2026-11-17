// bit0 = Saturday, matching the server's availableDays bitmask.
export const DAYS: { bit: number; short: string; label: string }[] = [
  { bit: 1, short: "Sat", label: "Saturday" },
  { bit: 2, short: "Sun", label: "Sunday" },
  { bit: 4, short: "Mon", label: "Monday" },
  { bit: 8, short: "Tue", label: "Tuesday" },
  { bit: 16, short: "Wed", label: "Wednesday" },
  { bit: 32, short: "Thu", label: "Thursday" },
  { bit: 64, short: "Fri", label: "Friday" },
];

export const EVERY_DAY = 127;

/** Number of days set in an availableDays mask. */
export function countDays(mask: number): number {
  return DAYS.filter((d) => (mask & d.bit) !== 0).length;
}

export function daysLabel(mask: number): string {
  if (mask === EVERY_DAY) return "Every day";
  if (mask === 0) return "No days";
  return DAYS.filter((d) => (mask & d.bit) !== 0)
    .map((d) => d.short)
    .join(", ");
}

export function daysPerWeekLabel(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"} a week`;
}

/** Error for a days-per-week count that the chosen days cannot cover, else null. */
export function daysPerWeekError(
  daysPerWeek: number | null,
  availableDays: number,
): string | null {
  if (daysPerWeek === null) return null;
  const available = countDays(availableDays);
  if (daysPerWeek > available) {
    return `Pick at least ${daysPerWeek} days, or fewer days a week.`;
  }
  return null;
}
