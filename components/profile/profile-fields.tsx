"use client";

import { useEffect, useId, useState } from "react";
import { Check, Circle, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SUBJECTS,
  searchAreas,
  type FieldDef,
  type FormErrors,
  type Gender,
  type Option,
  type ProfileForm,
} from "@/lib/profile";

const control =
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
}

export function ProfileFields({
  fields,
  form,
  errors,
  onChange,
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
}: {
  field: FieldDef;
  form: ProfileForm;
  error?: string;
  onChange: ProfileFieldsProps["onChange"];
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [field.hint && hintId, error && errorId].filter(Boolean).join(" ") ||
    undefined;

  const meta = (
    <>
      {field.hint && (
        <p id={hintId} className="text-sm text-[var(--color-text-secondary)]">
          {field.hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
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
          <ChipGroup
            name={id}
            options={SUBJECTS}
            value={form.subjectIds}
            multiple
            onChange={(subjectIds) => onChange({ subjectIds })}
          />
        ) : (
          <AreaPicker
            name={id}
            multiple={field.kind === "areas"}
            value={form.areaIds}
            onChange={(areaIds) => onChange({ areaIds })}
          />
        )}
        {meta}
      </fieldset>
    );
  }

  const key = field.key as Exclude<
    keyof ProfileForm,
    "gender" | "areaIds" | "subjectIds"
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

function Chip({
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

function ChipGroup({
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

function AreaPicker({
  name,
  multiple,
  value,
  onChange,
}: {
  name: string;
  multiple: boolean;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option[]>([]);
  const searchId = useId();

  useEffect(() => {
    let live = true;
    searchAreas(query).then((r) => live && setResults(r));
    return () => {
      live = false;
    };
  }, [query]);

  // Keep chosen areas visible even when the search filters them out.
  useEffect(() => {
    searchAreas("").then((all) =>
      setSelected(all.filter((a) => value.includes(a.id))),
    );
  }, [value]);

  const shown = [...selected, ...results.filter((r) => !value.includes(r.id))];

  return (
    <div className="grid gap-3">
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search areas
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search areas, like Dhanmondi"
          autoComplete="off"
          className={cn(control, "h-12 pl-11")}
        />
      </div>
      {multiple && value.length > 0 && (
        <p
          className="text-sm text-[var(--color-text-secondary)]"
          aria-live="polite"
        >
          {value.length} selected
        </p>
      )}
      {shown.length > 0 ? (
        <ChipGroup
          name={name}
          options={shown}
          value={value}
          multiple={multiple}
          onChange={onChange}
        />
      ) : (
        <p
          className="text-sm text-[var(--color-text-secondary)]"
          aria-live="polite"
        >
          No areas match “{query.trim()}”.
        </p>
      )}
    </div>
  );
}
