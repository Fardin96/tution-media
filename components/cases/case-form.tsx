"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import {
  DialogActions,
  Field,
  textareaClass,
} from "@/components/admin/admin-ui";
import { CASE_DETAILS_MAX, validateCaseDetails } from "@/lib/cases";

export type CaseChoice<V extends string> = {
  value: V;
  label: string;
  hint: string;
};

/** Radio cards. The input is a real radio, so arrow keys and screen readers work as usual. */
function ChoiceCards<V extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  choices: CaseChoice<V>[];
  value: V | null;
  onChange: (value: V) => void;
  error?: string;
}) {
  const errorId = useId();
  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      className="grid min-w-0 gap-2"
    >
      <legend className="mb-1.5 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
        {legend}
      </legend>
      {choices.map((choice) => (
        <label
          key={choice.value}
          className={cn(
            "relative flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-[16px] px-4 py-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.1)] transition-[background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
            "hover:bg-[var(--color-neutral-off-white)]",
            "has-[:checked]:bg-[var(--color-secondary-sky)] has-[:checked]:shadow-[0_0_0_2px_var(--color-primary-core)]",
            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-primary-core)]",
          )}
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
            className="sr-only"
          />
          <span className="text-sm font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
            {choice.label}
          </span>
          <span className="text-xs text-pretty text-[var(--color-text-secondary)]">
            {choice.hint}
          </span>
        </label>
      ))}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-[var(--color-semantic-error-text)]"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The shared body of the report and dispute dialogs: a choice, a details box with a counter,
 * a note, and the actions. Mounted only while the dialog is open, so it starts empty each time.
 */
export function CaseForm<V extends string>({
  legend,
  name,
  choices,
  choiceError,
  detailsLabel,
  detailsHint,
  note,
  submitLabel,
  pending,
  serverError,
  onCancel,
  onSubmit,
}: {
  legend: string;
  name: string;
  choices: CaseChoice<V>[];
  choiceError: string;
  detailsLabel: string;
  detailsHint: string;
  note: ReactNode;
  submitLabel: string;
  pending: boolean;
  serverError?: string;
  onCancel: () => void;
  onSubmit: (choice: V, details: string) => void;
}) {
  const [choice, setChoice] = useState<V | null>(null);
  const [details, setDetails] = useState("");
  const [attempted, setAttempted] = useState(false);
  const detailsError = attempted ? validateCaseDetails(details) : undefined;
  const missingChoice = attempted && choice === null ? choiceError : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (choice === null || validateCaseDetails(details)) return;
    onSubmit(choice, details.trim());
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <ChoiceCards
        legend={legend}
        name={name}
        choices={choices}
        value={choice}
        onChange={setChoice}
        error={missingChoice}
      />
      <Field label={detailsLabel} hint={detailsHint} error={detailsError}>
        {({ id, describedBy, invalid }) => (
          <div className="grid gap-1.5">
            <textarea
              id={id}
              required
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={textareaClass}
            />
            <p className="text-end text-xs text-[var(--color-text-secondary)] tabular-nums">
              {details.length}/{CASE_DETAILS_MAX}
            </p>
          </div>
        )}
      </Field>
      <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
        {note}
      </p>
      {serverError && (
        <p
          role="alert"
          className="text-sm text-pretty text-[var(--color-semantic-error-text)]"
        >
          {serverError}
        </p>
      )}
      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={cn(secondaryButton, "min-h-11")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={cn(primaryButton, "min-h-11")}
        >
          {pending ? "Sending..." : submitLabel}
        </button>
      </DialogActions>
    </form>
  );
}
