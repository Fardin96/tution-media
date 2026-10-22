"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  makeSessionToken,
  type PlacePrediction,
} from "@/lib/places";

const control =
  "w-full rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] px-4 text-base text-[var(--color-neutral-charcoal)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--color-neutral-gray)] hover:border-[var(--color-neutral-charcoal)] focus-visible:border-[var(--color-primary-core)] focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)] focus-visible:outline-none aria-invalid:border-[var(--color-semantic-error-text)]";

export interface AddressValue {
  address: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
}

interface AddressAutocompleteProps {
  id?: string;
  value: AddressValue;
  label: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  describedBy?: string;
  autoComplete?: string;
  onChange: (value: AddressValue) => void;
}

export function AddressAutocomplete({
  id: externalId,
  value,
  label,
  placeholder = "Start typing an address",
  hint,
  error,
  optional,
  describedBy,
  autoComplete = "street-address",
  onChange,
}: AddressAutocompleteProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const listboxId = `${id}-listbox`;
  const inputDescribedBy =
    [hint && hintId, error && errorId, describedBy].filter(Boolean).join(" ") ||
    undefined;

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");
  const sessionTokenRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

  const ensureSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) sessionTokenRef.current = makeSessionToken();
    return sessionTokenRef.current;
  }, []);

  const clearSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  const closeList = useCallback(() => {
    setPredictions([]);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const selectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      setLoading(true);
      closeList();
      const token = ensureSessionToken();
      try {
        const details = await fetchPlaceDetails(prediction.placeId, token);
        onChange({
          address: details.formattedAddress,
          placeId: prediction.placeId,
          latitude: details.location.latitude,
          longitude: details.location.longitude,
        });
        setAnnouncement(`${details.formattedAddress} selected.`);
      } catch (err) {
        setAnnouncement(
          err instanceof Error
            ? err.message
            : "Couldn't fetch address details.",
        );
      } finally {
        setLoading(false);
        clearSessionToken();
      }
    },
    [ensureSessionToken, onChange, closeList, clearSessionToken],
  );

  const handleInputChange = (next: string) => {
    onChange({
      address: next,
      placeId: "",
      latitude: null,
      longitude: null,
    });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setActiveIndex(-1);

    const trimmed = next.trim();
    if (trimmed.length < 3) {
      closeList();
      return;
    }

    setLoading(true);
    const token = ensureSessionToken();
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchPlacePredictions(trimmed, token);
        if (!results.length) {
          closeList();
          setAnnouncement("No address suggestions found.");
        } else {
          setPredictions(results);
          setOpen(true);
          setAnnouncement(`${results.length} address suggestions available.`);
        }
      } catch (err) {
        closeList();
        setAnnouncement(
          err instanceof Error ? err.message : "Couldn't fetch suggestions.",
        );
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const clear = useCallback(() => {
    onChange({ address: "", placeId: "", latitude: null, longitude: null });
    closeList();
    clearSessionToken();
  }, [onChange, closeList, clearSessionToken]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !predictions.length) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % predictions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + predictions.length) % predictions.length,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0) {
          void selectPrediction(predictions[activeIndex]);
        } else if (predictions[0]) {
          void selectPrediction(predictions[0]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="grid gap-2" ref={containerRef}>
      <label
        htmlFor={id}
        className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {label}
        {optional && (
          <span className="font-normal text-[var(--color-text-secondary)]">
            {" "}
            (optional)
          </span>
        )}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <MapPin
            aria-hidden="true"
            className="size-4 text-[var(--color-text-secondary)]"
          />
        </div>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          autoComplete={autoComplete}
          value={value.address}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={inputDescribedBy}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (predictions.length) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            control,
            "h-12 pr-10 pl-10",
            error && "border-[var(--color-semantic-error-text)]",
          )}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {loading ? (
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin text-[var(--color-text-secondary)] motion-reduce:animate-none"
            />
          ) : value.placeId || value.address ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear address"
              className="flex size-6 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-neutral-charcoal)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-core)]"
            >
              <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      </div>

      {hint && !error && (
        <p id={hintId} className="text-sm text-[var(--color-text-secondary)]">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="text-sm font-medium text-[var(--color-semantic-error-text)]"
        >
          {error}
        </p>
      )}

      {open && predictions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Address suggestions"
          className="z-10 -mt-1 max-h-64 overflow-auto rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] py-2 shadow-lg"
        >
          {predictions.map((p, i) => (
            <li
              key={p.placeId}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => {
                void selectPrediction(p);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "cursor-pointer px-4 py-2.5 text-sm transition-colors",
                i === activeIndex
                  ? "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]"
                  : "text-[var(--color-neutral-charcoal)]",
              )}
            >
              <span className="block font-medium">{p.mainText}</span>
              <span className="block text-[var(--color-text-secondary)]">
                {p.secondaryText}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
