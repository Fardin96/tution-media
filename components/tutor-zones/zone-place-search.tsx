"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { control } from "@/components/profile/profile-fields";
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  makeSessionToken,
  type PlacePrediction,
} from "@/lib/places";
import { toastError } from "@/lib/toast";

export interface ZonePlace {
  placeId: string;
  addressText: string;
  lat: number;
  lng: number;
}

interface ZonePlaceSearchProps {
  id: string;
  /** The saved address. When it changes outside the search (for example after a map pick), the input follows it. */
  address: string | null;
  invalid?: boolean;
  describedBy?: string;
  onSelect: (place: ZonePlace) => void;
}

const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

export function ZonePlaceSearch({
  id,
  address,
  invalid,
  describedBy,
  onSelect,
}: ZonePlaceSearchProps) {
  const listboxId = `${id}-listbox`;
  const statusId = `${id}-status`;

  const [query, setQuery] = useState(address ?? "");
  const [syncedAddress, setSyncedAddress] = useState(address);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState("");

  const tokenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Follow the saved address when the parent changes it, without an effect.
  if (address !== syncedAddress) {
    setSyncedAddress(address);
    setQuery(address ?? "");
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function sessionToken() {
    if (!tokenRef.current) tokenRef.current = makeSessionToken();
    return tokenRef.current;
  }

  function closeList() {
    setPredictions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleChange(next: string) {
    setQuery(next);
    setActiveIndex(-1);
    setStatus("");
    if (timerRef.current) clearTimeout(timerRef.current);
    const request = ++requestRef.current;

    const trimmed = next.trim();
    if (trimmed.length < MIN_QUERY) {
      closeList();
      setLoading(false);
      return;
    }

    setLoading(true);
    const token = sessionToken();
    timerRef.current = setTimeout(async () => {
      try {
        const results = await fetchPlacePredictions(trimmed, token);
        if (request !== requestRef.current) return;
        if (results.length === 0) {
          closeList();
          setStatus("No address suggestions found.");
        } else {
          setPredictions(results);
          setOpen(true);
        }
      } catch (err) {
        if (request !== requestRef.current) return;
        closeList();
        setStatus(
          err instanceof Error ? err.message : "Couldn't load suggestions.",
        );
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  async function selectPrediction(prediction: PlacePrediction) {
    requestRef.current++;
    closeList();
    setLoading(true);
    try {
      const details = await fetchPlaceDetails(
        prediction.placeId,
        sessionToken(),
      );
      onSelect({
        placeId: prediction.placeId,
        addressText: details.formattedAddress,
        lat: details.location.latitude,
        lng: details.location.longitude,
      });
      setQuery(details.formattedAddress);
      setSyncedAddress(details.formattedAddress);
    } catch (err) {
      toastError("Couldn't load that place. Try another.", err);
    } finally {
      tokenRef.current = null;
      setLoading(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || predictions.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % predictions.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + predictions.length) % predictions.length,
        );
        break;
      case "Enter": {
        event.preventDefault();
        const choice = predictions[activeIndex] ?? predictions[0];
        if (choice) void selectPrediction(choice);
        break;
      }
      case "Escape":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className="grid gap-2">
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          aria-invalid={invalid ? true : undefined}
          aria-describedby={
            [describedBy, status && statusId].filter(Boolean).join(" ") ||
            undefined
          }
          placeholder="Search for an address"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            control,
            "h-12 ps-11 pe-11",
            invalid && "border-[var(--color-semantic-error-text)]",
          )}
        />
        {loading && (
          <Loader2
            aria-hidden="true"
            className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--color-text-secondary)] motion-reduce:animate-none"
          />
        )}
      </div>

      {open && predictions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Address suggestions"
          className="max-h-64 overflow-auto rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] py-2"
        >
          {predictions.map((prediction, index) => (
            <li
              key={prediction.placeId}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void selectPrediction(prediction)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "cursor-pointer px-4 py-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none",
                index === activeIndex
                  ? "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]"
                  : "text-[var(--color-neutral-charcoal)]",
              )}
            >
              <span className="block font-medium">{prediction.mainText}</span>
              <span className="block text-[var(--color-text-secondary)]">
                {prediction.secondaryText}
              </span>
            </li>
          ))}
        </ul>
      )}

      {status && (
        <p
          id={statusId}
          aria-live="polite"
          className="text-sm text-[var(--color-text-secondary)]"
        >
          {status}
        </p>
      )}
    </div>
  );
}
