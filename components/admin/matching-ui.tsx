"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/profile/styles";
import {
  SEGMENT_BUTTON,
  SEGMENT_IDLE,
  SEGMENT_SELECTED,
  SEGMENT_TRACK,
} from "@/components/browse/browse-ui";
import { Field, inputClass } from "@/components/admin/admin-ui";
import { PendingLabel } from "@/components/ui/pending-label";

/** The Required / Ranks higher / Off control. Same tokens as Segmented, plus a disabled state. */
export function ModeControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={SEGMENT_TRACK}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              SEGMENT_BUTTON,
              "disabled:cursor-not-allowed disabled:opacity-60",
              selected ? SEGMENT_SELECTED : SEGMENT_IDLE,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A switch with its name and description read by screen readers. `pending` marks a running save. */
export function ToggleSwitch({
  label,
  description,
  on,
  disabled = false,
  pending = false,
  onChange,
}: {
  label: string;
  description?: string;
  on: boolean;
  disabled?: boolean;
  pending?: boolean;
  onChange: (on: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 flex-1 basis-64">
        <p
          id={labelId}
          className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
        >
          {label}
        </p>
        {description && (
          <p
            id={descriptionId}
            className="text-sm text-pretty text-[var(--color-text-secondary)]"
          >
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={() => onChange(!on)}
        className={cn(
          "group inline-flex min-h-11 shrink-0 items-center gap-3 rounded-full text-sm font-semibold text-[var(--color-neutral-charcoal)] transition-[scale] duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 motion-reduce:transition-none",
          focusRing,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-[background-color] duration-150 ease-out motion-reduce:transition-none",
            on
              ? "bg-[var(--color-primary-core)]"
              : "bg-[var(--color-neutral-gray)]",
          )}
        >
          <span
            className={cn(
              "block h-5 w-5 rounded-full bg-[var(--color-neutral-white)] shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-[translate,width] duration-200 ease-[var(--ease-out)] group-active:w-6 motion-reduce:transition-none",
              on
                ? "translate-x-5 ltr:group-active:translate-x-4 rtl:-translate-x-5 rtl:group-active:-translate-x-4"
                : "translate-x-0",
            )}
          />
        </span>
        <PendingLabel pending={pending}>{on ? "On" : "Off"}</PendingLabel>
      </button>
    </div>
  );
}

/**
 * A whole number between `min` and `max`. The text stays as typed while it is being edited; an
 * invalid value shows its message and is put back to the last valid value on blur.
 */
export function IntegerInput({
  label,
  value,
  min,
  max,
  hint,
  error,
  suffix,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  error?: string;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [localError, setLocalError] = useState<string>();

  return (
    <Field label={label} hint={hint} error={localError ?? error}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value;
              setText(next);
              const n = Number(next);
              if (
                next.trim() !== "" &&
                Number.isInteger(n) &&
                n >= min &&
                n <= max
              ) {
                setLocalError(undefined);
                onChange(n);
              } else {
                setLocalError(`Enter a whole number from ${min} to ${max}.`);
              }
            }}
            onBlur={() => {
              if (localError) {
                setText(String(value));
                setLocalError(undefined);
              }
            }}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(
              inputClass,
              "tabular-nums disabled:cursor-not-allowed disabled:opacity-60",
              suffix && "pe-14",
            )}
          />
          {suffix && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-[var(--color-text-secondary)]"
            >
              {suffix}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
