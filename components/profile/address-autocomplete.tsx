"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Expand } from "@/components/motion/expand";
import { secondaryButton } from "./styles";
import { roundCoord } from "@/lib/tutor-zones";
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  fetchReverseGeocode,
  makeSessionToken,
  PlaceLookupError,
  pickedPlaceLabel,
  type PlacePrediction,
} from "@/lib/places";

// Typing waits this long before a suggestion request goes out.
const DEBOUNCE_MS = 250;

// Loaded only when a Maps key is set, so the Maps SDK stays out of the initial bundle.
// One loader for both the component and the warm-up, so the chunk is requested once.
const loadAddressMap = () => import("./address-map");
// Starts the map's download when the toggle is hovered or focused, before the press.
const warmMap = () => void loadAddressMap();

const AddressMap = dynamic(() => loadAddressMap().then((m) => m.AddressMap), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="h-56 w-full rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-surface-subtle)] sm:h-64"
    />
  ),
});

const LOOKUP_FAILED =
  "Couldn't find an address there. Try again or type your address.";

// Only 400 and 422 carry a message the server wrote for the user; anything else gets the generic line.
function lookupFailure(err: unknown): string {
  return err instanceof PlaceLookupError &&
    (err.status === 400 || err.status === 422)
    ? err.message
    : LOOKUP_FAILED;
}

const control =
  "w-full rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] px-4 text-base text-[var(--color-neutral-charcoal)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--color-neutral-gray)] hover:border-[var(--color-neutral-charcoal)] focus-visible:border-[var(--color-primary-core)] focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)] focus-visible:outline-none aria-invalid:border-[var(--color-semantic-error-text)]";

export interface AddressValue {
  address: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
  /** The name of the saved district code, shown instead of the code. */
  districtName?: string | null;
  /** "pin": a map pin, saved without a place id. Defaults to a Places suggestion. */
  source?: "place" | "pin";
}

const isDhaka = (district: string) =>
  district
    .trim()
    .replace(/\s+district$/i, "")
    .trim()
    .toLowerCase() === "dhaka";

interface AddressAutocompleteProps {
  id?: string;
  value: AddressValue;
  label: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** false: the message is shown elsewhere; the input still gets aria-invalid. */
  showError?: boolean;
  optional?: boolean;
  describedBy?: string;
  autoComplete?: string;
  onChange: (value: AddressValue) => void;
  /** Called whenever a lookup starts or ends, so the form can hold its submit button. */
  onBusyChange?: (busy: boolean) => void;
}

export function AddressAutocomplete({
  id: externalId,
  value,
  label,
  placeholder = "Start typing an address",
  hint,
  error,
  showError = true,
  optional,
  describedBy,
  autoComplete = "street-address",
  onChange,
  onBusyChange,
}: AddressAutocompleteProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const listboxId = `${id}-listbox`;
  const districtId = `${id}-district`;
  const districtHintId = `${id}-district-hint`;
  const districtLineId = `${id}-district-line`;
  const warningId = `${id}-warning`;
  const pickHintId = `${id}-pick-hint`;
  const pinErrorId = `${id}-pin-error`;
  const mapHintId = `${id}-map-hint`;
  const mapWrapperId = `${id}-map`;
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  // The typing search; `lookup` is a details or reverse lookup in flight.
  const [loading, setLoading] = useState(false);
  const [lookup, setLookup] = useState(false);
  const busy = loading || lookup;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");
  const [districtPrompt, setDistrictPrompt] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  // The map stays hidden until pressed, so the Maps SDK loads on first open. Closed on every mount.
  const [mapOpen, setMapOpen] = useState(false);
  const [mapOpened, setMapOpened] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by every new search and by a selection or clear: an answer for an older id is dropped.
  const requestRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const district = value.district?.trim() ?? "";
  // A suggestion's place or a map pin: either one locates the value, even when the pin has no placeId.
  const located =
    !!value.placeId || (value.source === "pin" && value.latitude !== null);
  const showDistrict =
    located && !lookup && (districtPrompt || value.district === null);
  const showDistrictLine = located && !!district;
  const showWarning = located && !!district && !isDhaka(district);
  // Stays up while the list is open: hiding it made the listbox jump up under the input.
  // Hidden while a details or reverse lookup runs (the text is about to change); a typing search keeps it.
  const showPickHint = !!value.address.trim() && !located && !lookup;
  const pickHint = mapsKey
    ? "Pick a suggestion or pin it on the map."
    : "Pick a suggestion to set the location.";
  // The field's own error comes first; a pin error would only repeat the problem.
  const shownPinError = error ? null : pinError;
  const inputDescribedBy =
    [
      hint && hintId,
      error && showError && errorId,
      describedBy,
      showDistrictLine && districtLineId,
      showDistrict && districtHintId,
      showWarning && warningId,
      showPickHint && pickHintId,
      shownPinError && pinErrorId,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // The latest callback, read by the effects below, so a new callback identity doesn't re-report.
  const busyRef = useRef(onBusyChange);
  useEffect(() => {
    busyRef.current = onBusyChange;
  });

  useEffect(() => {
    busyRef.current?.(lookup);
  }, [lookup]);

  // An unmount mid-lookup must not leave the form waiting on it.
  useEffect(() => () => busyRef.current?.(false), []);

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

  // Drops a search that is waiting or in flight: its timer is cleared and its answer is ignored.
  const cancelSearch = useCallback(() => {
    requestRef.current++;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(false);
    setLookup(false);
  }, []);

  const selectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      cancelSearch();
      setLookup(true);
      const request = requestRef.current;
      setPinError(null);
      closeList();
      const token = ensureSessionToken();
      try {
        const details = await fetchPlaceDetails(prediction.placeId, token);
        // A newer search or a pin picked meanwhile owns the field now.
        if (request !== requestRef.current) return;
        const label = pickedPlaceLabel(prediction, details.formattedAddress);
        onChange({
          address: label,
          placeId: prediction.placeId,
          latitude: details.location.latitude,
          longitude: details.location.longitude,
          district: details.district,
          source: "place",
        });
        setDistrictPrompt(details.district === null);
        setAnnouncement(`${label} selected.`);
      } catch (err) {
        if (request !== requestRef.current) return;
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't fetch address details.";
        toast.error(message);
        setAnnouncement(message);
      } finally {
        if (request === requestRef.current) setLookup(false);
        clearSessionToken();
      }
    },
    [ensureSessionToken, onChange, closeList, clearSessionToken, cancelSearch],
  );

  // A pin set on the map: the coordinates count at once, the address follows from a reverse lookup.
  const pickPin = async (lat: number, lng: number, placeId?: string) => {
    const latitude = roundCoord(lat);
    const longitude = roundCoord(lng);
    const previousSource = value.source;
    // A POI click has Google's place: its coordinates are the POI's, so the pick counts as a place.
    const source = placeId ? "place" : "pin";
    cancelSearch();
    const request = requestRef.current;
    setLookup(true);
    setPinError(null);
    setDistrictPrompt(false);
    closeList();
    // No placeId until the lookup answers: the old one would point at the previous spot.
    onChange({
      ...value,
      placeId: "",
      latitude,
      longitude,
      district: null,
      districtName: null,
      source,
    });
    setAnnouncement("Finding the address for that spot.");

    try {
      const found = await fetchReverseGeocode(latitude, longitude, placeId);
      if (request !== requestRef.current) return;
      const label = found.formattedAddress.trim().slice(0, 500);
      onChange({
        address: label,
        placeId: found.placeId,
        latitude,
        longitude,
        district: found.district,
        districtName: null,
        source,
      });
      setDistrictPrompt(found.district === null);
      setAnnouncement(`Address set to ${label}.`);
    } catch (err) {
      if (request !== requestRef.current) return;
      // The pin is set but has no district: ask for it.
      setDistrictPrompt(true);
      // No Google place behind it, so it's the user's pin; a suggestion's text belongs to another spot.
      onChange({
        address: previousSource === "place" ? "" : value.address,
        placeId: "",
        latitude,
        longitude,
        district: null,
        districtName: null,
        source: "pin",
      });
      const message = lookupFailure(err);
      setPinError(message);
      setAnnouncement(message);
    } finally {
      if (request === requestRef.current) setLookup(false);
    }
  };

  const handleInputChange = (next: string) => {
    // A map pin keeps its place while the house number is typed; a suggestion's pin is dropped.
    const keepPin =
      value.source === "pin" &&
      value.latitude !== null &&
      value.longitude !== null;
    if (keepPin) onChange({ ...value, address: next });
    else
      onChange({
        address: next,
        placeId: "",
        latitude: null,
        longitude: null,
        district: null,
      });
    setDistrictPrompt(false);
    setPinError(null);
    setActiveIndex(-1);

    // Each change starts a new search; an earlier one that answers late is ignored.
    cancelSearch();
    const request = requestRef.current;

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
        if (request !== requestRef.current) return;
        if (!results.length) {
          closeList();
          setAnnouncement("No address suggestions found.");
        } else {
          setPredictions(results);
          setOpen(true);
          setAnnouncement(`${results.length} address suggestions available.`);
        }
      } catch (err) {
        if (request !== requestRef.current) return;
        closeList();
        setAnnouncement(
          err instanceof Error ? err.message : "Couldn't fetch suggestions.",
        );
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const clear = useCallback(() => {
    cancelSearch();
    onChange({
      address: "",
      placeId: "",
      latitude: null,
      longitude: null,
      district: null,
    });
    setDistrictPrompt(false);
    setPinError(null);
    closeList();
    clearSessionToken();
  }, [onChange, closeList, clearSessionToken, cancelSearch]);

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
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin text-[var(--color-text-secondary)] motion-reduce:animate-none"
            />
          ) : value.placeId || value.address || value.latitude !== null ? (
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
      {error && showError && (
        <p
          id={errorId}
          className="text-sm font-medium text-[var(--color-semantic-error-text)]"
        >
          {error}
        </p>
      )}
      {shownPinError && (
        <p
          id={pinErrorId}
          className="text-sm font-medium text-[var(--color-semantic-error-text)]"
        >
          {shownPinError}
        </p>
      )}
      {showDistrictLine && (
        <p
          id={districtLineId}
          className="text-sm text-[var(--color-text-secondary)]"
        >
          District: {value.districtName?.trim() || district}
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

      {showPickHint && (
        <p
          id={pickHintId}
          className="text-sm text-[var(--color-text-secondary)]"
        >
          {pickHint}
        </p>
      )}

      {mapsKey && (
        <div className="grid gap-2">
          <button
            type="button"
            aria-expanded={mapOpen}
            aria-controls={mapOpened ? mapWrapperId : undefined}
            onPointerEnter={warmMap}
            onFocus={warmMap}
            onClick={() => {
              setMapOpened(true);
              setMapOpen((open) => !open);
            }}
            className={cn(secondaryButton, "justify-self-start")}
          >
            {mapOpen
              ? "Hide map"
              : value.latitude !== null
                ? "Adjust pin on map"
                : "Pin on map"}
          </button>
          <Expand
            keepMounted
            id={mapWrapperId}
            open={mapOpen}
            className="grid gap-2"
          >
            <AddressMap
              apiKey={mapsKey}
              describedById={mapHintId}
              latitude={value.latitude}
              longitude={value.longitude}
              onPick={(lat, lng, placeId) => {
                void pickPin(lat, lng, placeId);
              }}
              onOutside={() => {
                setPinError("Pick a spot in Bangladesh.");
                setAnnouncement("Pick a spot in Bangladesh.");
              }}
              busy={busy}
            />
            <p
              id={mapHintId}
              className="text-sm text-[var(--color-text-secondary)]"
            >
              Tap or click the map, or drag the pin, to set your exact spot.
            </p>
          </Expand>
        </div>
      )}

      {showDistrict && (
        <div className="grid gap-2">
          <label
            htmlFor={districtId}
            className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
          >
            District
          </label>
          <input
            id={districtId}
            type="text"
            autoComplete="off"
            aria-required="true"
            aria-describedby={districtHintId}
            value={value.district ?? ""}
            onChange={(e) =>
              onChange({ ...value, district: e.target.value || null })
            }
            className={cn(control, "h-12")}
          />
          <p
            id={districtHintId}
            className="text-sm text-[var(--color-text-secondary)]"
          >
            {"We couldn't detect your district. Enter it manually."}
          </p>
        </div>
      )}

      {showWarning && (
        <p
          id={warningId}
          role="status"
          className="flex items-start gap-2 rounded-[12px] border border-[var(--color-semantic-warning)] bg-[var(--color-semantic-warning-surface)] px-4 py-3 text-sm text-[var(--color-semantic-warning-text)]"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {
            "We only operate in Dhaka right now. You can save, but you won't be matched with tutors or students until we launch in your district."
          }
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
