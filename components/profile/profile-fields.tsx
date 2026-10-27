"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AddressAutocomplete } from "./address-autocomplete";
import { Check, Circle, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";
import {
  searchAreas,
  searchSubjects,
  type FieldDef,
  type FormErrors,
  type Gender,
  type Option,
  type ProfileForm,
} from "@/lib/profile";

export const control =
  "w-full rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] px-4 text-base text-[var(--color-neutral-charcoal)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--color-neutral-gray)] hover:border-[var(--color-neutral-charcoal)] focus-visible:border-[var(--color-primary-core)] focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)] focus-visible:outline-none aria-invalid:border-[var(--color-semantic-error-text)]";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

interface ProfileFieldsProps {
  fields: FieldDef[];
  form: ProfileForm;
  errors: FormErrors;
  onChange: (patch: Partial<ProfileForm>) => void;
  /** false: messages are shown elsewhere (e.g. toasts); the field still gets aria-invalid. */
  inlineErrors?: boolean;
}

export function ProfileFields({
  fields,
  form,
  errors,
  onChange,
  inlineErrors = true,
}: ProfileFieldsProps) {
  return (
    <div className="grid gap-6">
      {fields.map((field) => (
        <Field
          key={field.key}
          field={field}
          form={form}
          error={errors[field.key]}
          onChange={onChange}
          inlineErrors={inlineErrors}
        />
      ))}
    </div>
  );
}

function Field({
  field,
  form,
  error,
  onChange,
  inlineErrors,
}: {
  field: FieldDef;
  form: ProfileForm;
  error?: string;
  onChange: ProfileFieldsProps["onChange"];
  inlineErrors: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const shownError = inlineErrors ? error : undefined;
  const describedBy =
    [field.hint && hintId, shownError && errorId].filter(Boolean).join(" ") ||
    undefined;

  const meta = (
    <>
      {field.hint && (
        <p id={hintId} className="text-sm text-[var(--color-text-secondary)]">
          {field.hint}
        </p>
      )}
      <FieldError id={errorId} message={shownError} />
    </>
  );

  if (
    field.kind === "gender" ||
    field.kind === "area" ||
    field.kind === "areas" ||
    field.kind === "subjects"
  ) {
    return (
      <fieldset
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="grid gap-3"
      >
        <legend className="mb-3 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          {field.label}
        </legend>
        {field.kind === "gender" ? (
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip
                key={g.value}
                type="radio"
                name={id}
                label={g.label}
                checked={form.gender === g.value}
                onChange={() => onChange({ gender: g.value })}
              />
            ))}
          </div>
        ) : field.kind === "subjects" ? (
          <SubjectPicker
            invalid={!!error}
            multiple
            value={form.subjectIds}
            onChange={(subjectIds) => onChange({ subjectIds })}
          />
        ) : (
          <AreaPicker
            invalid={!!error}
            multiple={field.kind === "areas"}
            value={form.areaIds}
            onChange={(areaIds) => onChange({ areaIds })}
          />
        )}
        {meta}
      </fieldset>
    );
  }

  if (field.kind === "address") {
    return (
      <div className="grid gap-2">
        <AddressAutocomplete
          id={id}
          value={{
            address: form.address,
            placeId: form.placeId,
            latitude: form.latitude,
            longitude: form.longitude,
          }}
          label={field.label}
          placeholder={field.placeholder}
          hint={field.hint}
          error={error}
          showError={inlineErrors}
          optional={field.optional}
          describedBy={describedBy}
          autoComplete={field.autoComplete}
          onChange={(value) =>
            onChange({
              address: value.address,
              placeId: value.placeId,
              latitude: value.latitude,
              longitude: value.longitude,
            })
          }
        />
      </div>
    );
  }

  const key = field.key as Exclude<
    keyof ProfileForm,
    | "gender"
    | "areaIds"
    | "subjectIds"
    | "address"
    | "placeId"
    | "latitude"
    | "longitude"
  >;
  const common = {
    id,
    name: field.key,
    value: form[key],
    placeholder: field.placeholder,
    autoComplete: field.autoComplete ?? "off",
    maxLength: field.maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [key]: e.target.value }),
  };

  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {field.label}
        {field.optional && (
          <span className="font-normal text-[var(--color-text-secondary)]">
            {" "}
            (optional)
          </span>
        )}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          {...common}
          rows={3}
          className={cn(control, "resize-y py-3")}
        />
      ) : (
        <input
          {...common}
          type={field.kind === "tel" ? "tel" : "text"}
          inputMode={field.kind === "tel" ? "tel" : undefined}
          className={cn(control, "h-12")}
        />
      )}
      {meta}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="text-sm font-medium text-[var(--color-semantic-error-text)]"
    >
      {message}
    </p>
  );
}

export function Chip({
  type,
  name,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  const Unchecked = type === "radio" ? Circle : Plus;
  return (
    <label
      className={cn(
        "group inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-[background-color,border-color,color,scale] duration-150 ease-out select-none active:scale-[0.96] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-primary-core)] motion-reduce:transition-none",
        checked
          ? "border-[var(--color-primary-core)] bg-[var(--color-primary-core)] text-[var(--color-neutral-white)]"
          : "border-[var(--color-border-control)] bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] hover:border-[var(--color-neutral-charcoal)]",
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {/* Plus/check cross-fade; the fill change is the static cue. */}
      <span aria-hidden="true" className="relative size-4">
        <Unchecked
          className={cn(
            "absolute inset-0 size-4 transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
            checked
              ? "scale-25 opacity-0 blur-[4px]"
              : "blur-0 scale-100 opacity-100",
          )}
        />
        <Check
          strokeWidth={2.5}
          className={cn(
            "absolute inset-0 size-4 transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
            checked
              ? "blur-0 scale-100 opacity-100"
              : "scale-25 opacity-0 blur-[4px]",
          )}
        />
      </span>
      {label}
    </label>
  );
}

export function ChipGroup({
  name,
  options,
  value,
  multiple,
  onChange,
}: {
  name: string;
  options: Option[];
  value: number[];
  multiple: boolean;
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const checked = value.includes(o.id);
        return (
          <Chip
            key={o.id}
            type={multiple ? "checkbox" : "radio"}
            name={name}
            label={o.name}
            checked={checked}
            onChange={() =>
              onChange(
                !multiple
                  ? [o.id]
                  : checked
                    ? value.filter((v) => v !== o.id)
                    : [...value, o.id],
              )
            }
          />
        );
      })}
    </div>
  );
}

export function AreaPicker({
  invalid,
  multiple,
  value,
  onChange,
}: {
  invalid: boolean;
  multiple: boolean;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  // Every area seen so far, so chosen ids keep their names after the search changes.
  const [known, setKnown] = useState<Map<number, Option>>(() => new Map());
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();

  useEffect(() => {
    let live = true;
    searchAreas(query).then((r) => {
      if (!live) return;
      setResults(r);
      setKnown((m) => new Map([...m, ...r.map((o) => [o.id, o] as const)]));
    });
    return () => {
      live = false;
    };
  }, [query]);

  // Names for edit mode, where chosen ids arrive before any search has run.
  useEffect(() => {
    searchAreas("").then((all) =>
      setKnown((m) => new Map([...all.map((o) => [o.id, o] as const), ...m])),
    );
  }, []);

  const selected = value.flatMap((id) => known.get(id) ?? []);
  const available = results.filter((r) => !value.includes(r.id));

  const add = (o: Option) => {
    onChange(multiple ? [...value, o.id] : [o.id]);
    setQuery("");
    setAnnouncement(`${o.name} selected.`);
    inputRef.current?.focus();
  };

  const remove = (o: Option) => {
    onChange(value.filter((id) => id !== o.id));
    setAnnouncement(`${o.name} removed.`);
    inputRef.current?.focus();
  };

  return (
    <div className="grid gap-3">
      <label htmlFor={searchId} className="sr-only">
        {multiple ? "Search areas to add" : "Search areas"}
      </label>
      {/* Field-styled wrapper: chosen areas sit inside it as tokens, before the search text. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          control,
          invalid && "border-[var(--color-semantic-error-text)]",
          "flex min-h-12 cursor-text flex-wrap items-center gap-2 py-2 pl-3 has-[input:focus-visible]:border-[var(--color-primary-core)] has-[input:focus-visible]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)]",
        )}
      >
        {selected.length === 0 && (
          <Search
            aria-hidden="true"
            className="ml-1 size-4 shrink-0 text-[var(--color-text-secondary)]"
          />
        )}
        {selected.map((o) => (
          <span
            key={o.id}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-secondary-sky)] pr-1 pl-3 text-sm font-medium text-[var(--color-primary-deep)]"
          >
            {o.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(o);
              }}
              aria-label={`Remove ${o.name}`}
              className="relative flex size-6 items-center justify-center rounded-full transition-colors duration-150 after:absolute after:-inset-1.5 hover:bg-[color-mix(in_oklab,var(--color-primary-deep)_12%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-core)]"
            >
              <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !query && selected.length)
              remove(selected[selected.length - 1]);
            if (e.key === "Enter" && query.trim() && available.length) {
              e.preventDefault();
              add(available[0]);
            }
          }}
          placeholder={
            selected.length === 0
              ? "Search areas, like Dhanmondi"
              : multiple
                ? "Add another area"
                : "Search to change area"
          }
          autoComplete="off"
          className="h-8 min-w-[10ch] flex-1 bg-transparent text-base outline-none placeholder:text-[var(--color-neutral-gray)] [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {available.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Suggested areas">
          {available.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => add(o)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] px-4 text-sm font-medium text-[var(--color-neutral-charcoal)] transition-[border-color,background-color,scale] duration-150 ease-out hover:border-[var(--color-neutral-charcoal)] active:scale-[0.96] motion-reduce:transition-none",
                  focusRing,
                )}
              >
                <Plus aria-hidden="true" className="size-4" />
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        query.trim() && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No areas match “{query.trim()}”.
          </p>
        )
      )}
    </div>
  );
}

export function SubjectPicker({
  invalid,
  multiple = true,
  value,
  onChange,
}: {
  invalid: boolean;
  multiple?: boolean;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  const [known, setKnown] = useState<Map<number, Option>>(() => new Map());
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();

  useEffect(() => {
    let live = true;
    searchSubjects(query).then((r) => {
      if (!live) return;
      setResults(r);
      setKnown((m) => new Map([...m, ...r.map((o) => [o.id, o] as const)]));
    });
    return () => {
      live = false;
    };
  }, [query]);

  useEffect(() => {
    searchSubjects("").then((all) =>
      setKnown((m) => new Map([...all.map((o) => [o.id, o] as const), ...m])),
    );
  }, []);

  const selected = value.flatMap((id) => known.get(id) ?? []);
  const available = results.filter((r) => !value.includes(r.id));

  const add = (o: Option) => {
    onChange(multiple ? [...value, o.id] : [o.id]);
    setQuery("");
    setAnnouncement(`${o.name} selected.`);
    inputRef.current?.focus();
  };

  const remove = (o: Option) => {
    onChange(value.filter((id) => id !== o.id));
    setAnnouncement(`${o.name} removed.`);
    inputRef.current?.focus();
  };

  return (
    <div className="grid gap-3">
      <label htmlFor={searchId} className="sr-only">
        {multiple ? "Search subjects to add" : "Search subjects"}
      </label>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          control,
          invalid && "border-[var(--color-semantic-error-text)]",
          "flex min-h-12 cursor-text flex-wrap items-center gap-2 py-2 pl-3 has-[input:focus-visible]:border-[var(--color-primary-core)] has-[input:focus-visible]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)]",
        )}
      >
        {selected.length === 0 && (
          <Search
            aria-hidden="true"
            className="ml-1 size-4 shrink-0 text-[var(--color-text-secondary)]"
          />
        )}
        {selected.map((o) => (
          <span
            key={o.id}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-secondary-sky)] pr-1 pl-3 text-sm font-medium text-[var(--color-primary-deep)]"
          >
            {o.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(o);
              }}
              aria-label={`Remove ${o.name}`}
              className="relative flex size-6 items-center justify-center rounded-full transition-colors duration-150 after:absolute after:-inset-1.5 hover:bg-[color-mix(in_oklab,var(--color-primary-deep)_12%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-core)]"
            >
              <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !query && selected.length)
              remove(selected[selected.length - 1]);
            if (e.key === "Enter" && query.trim() && available.length) {
              e.preventDefault();
              add(available[0]);
            }
          }}
          placeholder={
            selected.length === 0
              ? "Search subjects, like Physics"
              : multiple
                ? "Add another subject"
                : "Search to change subject"
          }
          autoComplete="off"
          className="h-8 min-w-[10ch] flex-1 bg-transparent text-base outline-none placeholder:text-[var(--color-neutral-gray)] [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {available.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Suggested subjects">
          {available.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => add(o)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] px-4 text-sm font-medium text-[var(--color-neutral-charcoal)] transition-[border-color,background-color,scale] duration-150 ease-out hover:border-[var(--color-neutral-charcoal)] active:scale-[0.96] motion-reduce:transition-none",
                  focusRing,
                )}
              >
                <Plus aria-hidden="true" className="size-4" />
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        query.trim() && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No subjects match “{query.trim()}”.
          </p>
        )
      )}
    </div>
  );
}
