"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, control, FieldError } from "@/components/profile/profile-fields";
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
  // Every subject seen so far, so added chips keep their names after the search changes.
  const [known, setKnown] = useState<Map<number, Option>>(() => new Map());
  const [announcement, setAnnouncement] = useState("");
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
  const suggestions = query.trim()
    ? results.filter((r) => !value.includes(r.id)).slice(0, 6)
    : [];

  const toggle = (id: number) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );

  const add = (o: Option) => {
    onChange([...value, o.id]);
    setQuery("");
    setAnnouncement(`${o.name} selected.`);
    inputRef.current?.focus();
  };

  const errorId = `${idPrefix}-subjectIds-error`;
  const searchId = `${idPrefix}-subjectSearch`;

  return (
    <fieldset className="grid min-w-0 gap-5">
      <legend className={cn(labelClass, "mb-3")}>Subjects</legend>

      <div className="flex flex-wrap gap-2">
        {profileSubjects.map((o) => (
          <Chip
            key={o.id}
            type="checkbox"
            name={`${idPrefix}-subjectIds`}
            label={o.name}
            checked={value.includes(o.id)}
            onChange={() => toggle(o.id)}
          />
        ))}
        {addedIds.map((id) => (
          <Chip
            key={id}
            type="checkbox"
            name={`${idPrefix}-subjectIds`}
            label={nameOf(id)}
            checked={value.includes(id)}
            onChange={() => toggle(id)}
          />
        ))}
      </div>

      {profileSubjects.length === 0 && (
        <p className={hintClass}>
          Your profile has no subjects yet. Add one below.
        </p>
      )}

      <div className="grid gap-3">
        <label htmlFor={searchId} className="sr-only">
          Search subjects to add
        </label>
        <input
          ref={inputRef}
          id={searchId}
          type="search"
          value={query}
          placeholder="Add a subject, like Physics"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions.length > 0) {
              e.preventDefault();
              add(suggestions[0]);
            }
          }}
          className={cn(
            control,
            "h-12 [&::-webkit-search-cancel-button]:appearance-none",
          )}
        />

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {suggestions.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Suggested subjects">
            {suggestions.map((o) => (
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
            <p className={hintClass}>
              {`No subjects match “${query.trim()}”.`}
            </p>
          )
        )}
      </div>

      {addedNames.length > 0 && (
        <p className={hintClass}>
          {`Also adds ${joinNames(addedNames)} to your profile subjects.`}
        </p>
      )}

      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
