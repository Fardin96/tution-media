"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { control, FieldError } from "@/components/profile/profile-fields";
import { focusRing } from "@/components/profile/styles";
import {
  optionName,
  searchSubjects,
  SUBJECTS,
  type Option,
} from "@/lib/profile";
import { newProfileSubjects } from "@/lib/tutor-requirements";

const labelClass = "text-sm font-semibold text-[var(--color-neutral-charcoal)]";
const hintClass = "text-sm text-[var(--color-text-secondary)]";
const MAX_RESULTS = 6;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

interface SetSubjectPickerProps {
  idPrefix: string;
  profileSubjects: Option[];
  value: number[];
  onChange: (ids: number[]) => void;
  error?: string;
}

export function SetSubjectPicker({
  idPrefix,
  profileSubjects,
  value,
  onChange,
  error,
}: SetSubjectPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  // Every subject seen so far, so tokens keep their names after the search changes.
  const [known, setKnown] = useState<Map<number, Option>>(() => new Map());
  const [announcement, setAnnouncement] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const profileIds = profileSubjects.map((o) => o.id);
  const nameOf = (id: number) =>
    known.get(id)?.name ??
    profileSubjects.find((o) => o.id === id)?.name ??
    optionName(SUBJECTS, id);

  const addedIds = newProfileSubjects(value, profileIds);
  const addedNames = addedIds.map(nameOf);
  const unselectedProfile = profileSubjects.filter(
    (o) => !value.includes(o.id),
  );
  const available = query.trim()
    ? results.filter((r) => !value.includes(r.id)).slice(0, MAX_RESULTS)
    : [];
  const listOpen = open && available.length > 0;
  const activeIndex = Math.min(active, Math.max(available.length - 1, 0));
  const activeOption = listOpen ? available[activeIndex] : undefined;

  const errorId = `${idPrefix}-subjectIds-error`;
  const searchId = `${idPrefix}-subjectSearch`;
  const listboxId = `${idPrefix}-subjectListbox`;
  const profileLabelId = `${idPrefix}-subjectProfileLabel`;
  const optionId = (id: number) => `${idPrefix}-subject-${id}`;

  const add = (o: Option) => {
    onChange([...value, o.id]);
    setQuery("");
    setOpen(false);
    setActive(0);
    setAnnouncement(`${o.name} added.`);
    inputRef.current?.focus();
  };

  const remove = (id: number) => {
    onChange(value.filter((v) => v !== id));
    setAnnouncement(`${nameOf(id)} removed.`);
    inputRef.current?.focus();
  };

  return (
    <fieldset className="grid min-w-0 gap-5">
      <legend className={cn(labelClass, "mb-3")}>Subjects</legend>

      <div className="grid gap-3">
        <label htmlFor={searchId} className="sr-only">
          Search subjects to add
        </label>

        {/* One field: tokens sit inside it, then the search text. */}
        <div
          onClick={() => inputRef.current?.focus()}
          className={cn(
            control,
            "flex min-h-12 cursor-text flex-wrap items-center gap-2 py-2 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-[var(--color-primary-core)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)]",
            error && "border-[var(--color-semantic-error-text)]",
          )}
        >
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-secondary-sky)] ps-3 text-sm font-medium text-[var(--color-primary-deep)] transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none starting:scale-[0.96] starting:opacity-0"
            >
              {nameOf(id)}
              {/* 40px hit area, 24px visible hover circle; the negative margin keeps the token height. */}
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={`Remove ${nameOf(id)}`}
                className={cn(
                  "group relative -my-1 flex size-10 shrink-0 items-center justify-center rounded-full",
                  focusRing,
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex size-6 items-center justify-center rounded-full transition-colors duration-150 group-hover:bg-[color-mix(in_oklab,var(--color-primary-deep)_12%,transparent)]"
                >
                  <X
                    aria-hidden="true"
                    className="size-3.5"
                    strokeWidth={2.5}
                  />
                </span>
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={searchId}
            type="text"
            role="combobox"
            value={query}
            placeholder={
              value.length === 0 ? "Add a subject, like Physics" : "Add another"
            }
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listOpen ? listboxId : undefined}
            aria-activedescendant={
              activeOption ? optionId(activeOption.id) : undefined
            }
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !query && value.length > 0) {
                remove(value[value.length - 1]);
                return;
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                if (available.length === 0) return;
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setOpen(true);
                setActive(
                  (activeIndex + step + available.length) % available.length,
                );
                return;
              }
              if (e.key === "Enter") {
                // Never submit the set form from this field.
                e.preventDefault();
                if (activeOption) add(activeOption);
                return;
              }
              if (e.key === "Escape" && listOpen) {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="h-8 min-w-32 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--color-neutral-gray)]"
          />
        </div>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {listOpen ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Matching subjects"
            // Keep focus in the input while an option is pressed.
            onMouseDown={(e) => e.preventDefault()}
            className="grid gap-1 rounded-[16px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_12px_32px_-12px_rgb(0_0_0/0.08)]"
          >
            {available.map((o, i) => (
              <li
                key={o.id}
                id={optionId(o.id)}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => add(o)}
                className="flex min-h-11 cursor-pointer items-center rounded-[12px] px-3 text-sm font-medium text-[var(--color-neutral-charcoal)] aria-selected:bg-[var(--color-secondary-sky)] aria-selected:text-[var(--color-primary-deep)]"
              >
                {o.name}
              </li>
            ))}
          </ul>
        ) : (
          open &&
          query.trim() && (
            <p className={hintClass}>
              {`No subjects match “${query.trim()}”.`}
            </p>
          )
        )}
      </div>

      {profileSubjects.length === 0 ? (
        <p className={hintClass}>
          Your profile has no subjects yet. Search above to add one.
        </p>
      ) : (
        unselectedProfile.length > 0 && (
          <div className="grid gap-2">
            <span id={profileLabelId} className={labelClass}>
              From your profile
            </span>
            <ul
              aria-labelledby={profileLabelId}
              className="flex flex-wrap gap-2"
            >
              {unselectedProfile.map((o) => (
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
          </div>
        )
      )}

      {addedNames.length > 0 && (
        <p className={hintClass}>
          {`Also adds ${joinNames(addedNames)} to your profile subjects.`}
        </p>
      )}

      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
