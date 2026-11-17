"use client";

import { cn } from "@/lib/utils";
import { DAYS, daysPerWeekLabel } from "@/lib/days";
import { Chip, FieldError } from "@/components/profile/profile-fields";

const labelClass = "text-sm font-semibold text-[var(--color-neutral-charcoal)]";

/** Weekday chips over an availableDays bitmask (bit0 = Saturday). */
export function DaysOfWeekField({
  idPrefix,
  label = "Days",
  value,
  onChange,
  error,
}: {
  idPrefix: string;
  label?: string;
  value: number;
  onChange: (mask: number) => void;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <span id={`${idPrefix}-availableDays-label`} className={labelClass}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${idPrefix}-availableDays-label`}
        aria-describedby={error ? `${idPrefix}-availableDays-error` : undefined}
        className="flex flex-wrap gap-2"
      >
        {DAYS.map((d) => (
          <Chip
            key={d.bit}
            type="checkbox"
            name={`${idPrefix}-availableDays`}
            label={d.label}
            checked={(value & d.bit) !== 0}
            onChange={() => onChange(value ^ d.bit)}
            invalid={Boolean(error)}
          />
        ))}
      </div>
      <FieldError id={`${idPrefix}-availableDays-error`} message={error} />
    </div>
  );
}

/** 1-7 segmented radio group for how many days a week. */
export function DaysPerWeekField({
  idPrefix,
  label = "Days per week",
  value,
  onChange,
  error,
}: {
  idPrefix: string;
  label?: string;
  value: number | null;
  onChange: (count: number) => void;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <span id={`${idPrefix}-daysPerWeek-label`} className={labelClass}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-invalid={error ? true : undefined}
        aria-labelledby={`${idPrefix}-daysPerWeek-label`}
        aria-describedby={error ? `${idPrefix}-daysPerWeek-error` : undefined}
        className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full bg-[var(--color-surface-subtle)] p-1"
      >
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <label
            key={d}
            className={cn(
              "flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-[background-color,color,scale] duration-150 ease-out select-none active:scale-[0.96] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-primary-core)] motion-reduce:transition-none",
              value === d
                ? "bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] shadow-xs"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-neutral-charcoal)]",
            )}
          >
            <input
              type="radio"
              name={`${idPrefix}-daysPerWeek`}
              value={d}
              checked={value === d}
              onChange={() => onChange(d)}
              className="sr-only"
            />
            {d}
          </label>
        ))}
      </div>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
        {value === null ? "Any number of days" : daysPerWeekLabel(value)}
      </p>
      <FieldError id={`${idPrefix}-daysPerWeek-error`} message={error} />
    </div>
  );
}
