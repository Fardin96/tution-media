"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  institutionApi,
  institutionDetails,
  type InstitutionOption,
} from "@/lib/institutions";

// Same look as the profile text inputs. A copy, not an import: profile-fields imports this file.
const control =
  "w-full rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] px-4 text-base text-[var(--color-neutral-charcoal)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--color-neutral-gray)] hover:border-[var(--color-neutral-charcoal)] focus-visible:border-[var(--color-primary-core)] focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)] focus-visible:outline-none aria-invalid:border-[var(--color-semantic-error-text)]";

// Typing waits this long before a search goes out.
const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

export interface InstitutionValue {
  name: string;
  institutionId: number | null;
}

interface InstitutionPickerProps {
  id: string;
  name?: string;
  value: InstitutionValue;
  onChange: (value: InstitutionValue) => void;
  /** Tutors and students see the same list; the order differs. */
  forRole: "tutor" | "student";
  invalid?: boolean;
  /** Ids of the error message, when there is one. */
  describedBy?: string;
  hint: string;
  placeholder?: string;
  maxLength?: number;
}

/**
 * Free text with a list of schools and universities. Typing is free text; picking a row sets the
 * id, and typing again clears it. A failed search just shows no list.
 */
export function InstitutionPicker({
  id,
  name,
  value,
  onChange,
  forRole,
  invalid,
  describedBy,
  hint,
  placeholder,
  maxLength,
}: InstitutionPickerProps) {
  const listboxId = `${id}-listbox`;
  const hintId = `${id}-hint`;
  const noteId = `${id}-note`;
  const pickedId = `${id}-picked`;
  const [options, setOptions] = useState<InstitutionOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");
  // A search of 2+ characters came back empty; the field stays free text.
  const [noMatch, setNoMatch] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drops a search that is waiting or in flight, so a late answer never reopens the list.
  function cancelSearch() {
    if (timerRef.current) clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    controllerRef.current = null;
  }

  function closeList() {
    setOpen(false);
    setOptions([]);
    setActiveIndex(-1);
    setNoMatch(false);
  }

  // Unmounting drops a search that is still waiting or in flight.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      controllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function search(text: string) {
    cancelSearch();
    const query = text.trim();
    if (query.length < MIN_CHARS) {
      closeList();
      return;
    }
    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      controllerRef.current = controller;
      institutionApi
        .search(query, forRole, controller.signal)
        .then((list) => {
          if (controller.signal.aborted) return;
          setOptions(list);
          setOpen(list.length > 0);
          setNoMatch(list.length === 0);
          setActiveIndex(-1);
          setAnnouncement(
            list.length === 0
              ? "No matches."
              : `${list.length} ${list.length === 1 ? "match" : "matches"}.`,
          );
        })
        .catch(() => {
          // A failed search leaves the field as plain text.
          if (controller.signal.aborted) return;
          closeList();
        });
    }, DEBOUNCE_MS);
  }

  function onInput(text: string) {
    onChange({ name: text, institutionId: null });
    setActiveIndex(-1);
    setNoMatch(false);
    search(text);
  }

  function pick(option: InstitutionOption) {
    cancelSearch();
    onChange({ name: option.name, institutionId: option.id });
    closeList();
    setAnnouncement(`${option.name} selected.`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // ArrowDown brings back a closed list, after Escape too. Alt+ArrowDown is the same key with Alt held.
    if (!open && event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(0);
      return;
    }
    if (!open || options.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Enter": {
        // Only a highlighted row is picked; Enter otherwise submits the form.
        if (activeIndex < 0) break;
        event.preventDefault();
        pick(options[activeIndex]);
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
    }
  }

  const picked = value.institutionId !== null;
  const noteShown = noMatch && !picked;
  const describedByIds =
    [picked && pickedId, hintId, noteShown && noteId, describedBy]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="grid gap-2" ref={containerRef}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          value={value.name}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={describedByIds}
          onChange={(event) => onInput(event.target.value)}
          onFocus={() => {
            if (options.length) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(control, "h-12", picked ? "pe-11" : undefined)}
        />
        {picked && (
          <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4 text-[var(--color-primary-core)]">
            <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
            <span id={pickedId} className="sr-only">
              From the list
            </span>
          </span>
        )}
        {/* Always rendered so aria-controls always points at it; hidden while closed. Overlays the fields below. */}
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Schools and universities"
          hidden={!open}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] py-2 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // Keeps focus in the input while the mouse picks a row.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(option)}
              className={cn(
                "cursor-pointer px-4 py-2.5 text-sm",
                index === activeIndex
                  ? "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]"
                  : "text-[var(--color-neutral-charcoal)]",
              )}
            >
              <span className="block font-semibold">{option.name}</span>
              <span className="block text-[var(--color-text-secondary)]">
                {institutionDetails(option)}
              </span>
              {option.matchedAlias && (
                <span className="block text-[var(--color-text-secondary)]">
                  matches “{option.matchedAlias}”
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p id={hintId} className="text-sm text-[var(--color-text-secondary)]">
        {hint}
      </p>
      {noteShown && (
        <p id={noteId} className="text-sm text-[var(--color-text-secondary)]">
          Not on the list. Type the full name.
        </p>
      )}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
