"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mapServerIssuesToFields } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import { invalidateTutorZones } from "@/lib/query-keys";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  LABEL_MAX,
  RADIUS_MAX_M,
  RADIUS_MIN_M,
  RADIUS_STEP_M,
  formatRadius,
  toCreateZonePayload,
  toZonePatch,
  tutorZoneApi,
  validateZoneForm,
  type TutorZone,
  type ZoneForm,
  type ZoneFormErrors,
} from "@/lib/tutor-zones";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import { control, FieldError } from "@/components/profile/profile-fields";
import { cn } from "@/lib/utils";
import { PendingLabel } from "@/components/ui/pending-label";
import { ZonePlaceSearch, type ZonePlace } from "./zone-place-search";

interface ZoneEditorProps {
  /** null while adding a new zone. */
  zone: TutorZone | null;
  form: ZoneForm;
  onFormChange: (patch: Partial<ZoneForm>) => void;
  onClose: () => void;
}

export function ZoneEditor({
  zone,
  form,
  onFormChange,
  onClose,
}: ZoneEditorProps) {
  const ids = useId();
  const labelId = `${ids}-label`;
  const placeId = `${ids}-place`;
  const placeHintId = `${ids}-place-hint`;
  const radiusId = `${ids}-radius`;
  const radiusHintId = `${ids}-radius-hint`;
  const queryClient = useQueryClient();

  const [errors, setErrors] = useState<ZoneFormErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const save = useMutation({
    mutationFn: async (): Promise<TutorZone | null> => {
      if (!zone) return tutorZoneApi.create(toCreateZonePayload(form));
      const patch = toZonePatch(zone, form);
      if (Object.keys(patch).length === 0) return null;
      return tutorZoneApi.update(zone.id, patch);
    },
    onSuccess: (saved) => {
      if (saved) {
        void invalidateTutorZones(queryClient);
        toastSuccess("Zone saved");
      }
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setErrors(mapServerIssuesToFields<keyof ZoneForm>(err.issues));
      }
      toastError("Couldn't save the zone.", err);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const next = validateZoneForm(form);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      if (next.label) nameRef.current?.focus();
      return;
    }
    save.mutate();
  }

  function clearError(key: keyof ZoneForm) {
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handlePlace(place: ZonePlace) {
    onFormChange({
      placeId: place.placeId,
      addressText: place.addressText,
      lat: place.lat,
      lng: place.lng,
    });
    clearError("lat");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-[var(--color-primary-core)]">
          {zone ? "Editing zone" : "New zone"}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-neutral-charcoal)]">
          {zone ? zone.label : "Add zone"}
        </h2>
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={labelId}
          className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
        >
          Zone name
        </label>
        <input
          ref={nameRef}
          id={labelId}
          type="text"
          maxLength={LABEL_MAX}
          autoComplete="off"
          value={form.label}
          aria-invalid={errors.label ? true : undefined}
          aria-describedby={errors.label ? `${labelId}-error` : undefined}
          onChange={(event) => {
            onFormChange({ label: event.target.value });
            clearError("label");
          }}
          className={cn(control, "h-12")}
        />
        <FieldError id={`${labelId}-error`} message={errors.label} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={placeId}
          className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
        >
          Place
        </label>
        <ZonePlaceSearch
          id={placeId}
          address={form.addressText}
          invalid={!!errors.lat}
          describedBy={placeHintId}
          onSelect={handlePlace}
        />
        <p
          id={placeHintId}
          className="text-sm text-pretty text-[var(--color-text-secondary)]"
        >
          Search for an address, or use Drop pin under the map. Drag the pin to
          fine-tune it.
        </p>
        {form.lat !== null && form.lng !== null && !form.addressText && (
          <p className="text-sm font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
            {`Pinned at ${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`}
          </p>
        )}
        <FieldError id={`${placeId}-error`} message={errors.lat} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor={radiusId}
            className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
          >
            Radius
          </label>
          <output
            htmlFor={radiusId}
            className="text-sm font-medium text-[var(--color-neutral-charcoal)] tabular-nums"
          >
            {formatRadius(form.radiusM)}
          </output>
        </div>
        <input
          id={radiusId}
          type="range"
          min={RADIUS_MIN_M}
          max={RADIUS_MAX_M}
          step={RADIUS_STEP_M}
          value={form.radiusM}
          aria-valuetext={formatRadius(form.radiusM)}
          aria-describedby={radiusHintId}
          aria-invalid={errors.radiusM ? true : undefined}
          onChange={(event) => {
            onFormChange({ radiusM: Number(event.target.value) });
            clearError("radiusM");
          }}
          className="h-11 w-full cursor-pointer accent-[var(--color-primary-core)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-secondary)] tabular-nums">
          <span>{formatRadius(RADIUS_MIN_M)}</span>
          <span>{formatRadius(RADIUS_MAX_M)}</span>
        </div>
        <p
          id={radiusHintId}
          className="text-sm text-pretty text-[var(--color-text-secondary)]"
        >
          Students inside this circle can find you.
        </p>
        <FieldError message={errors.radiusM} />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={save.isPending}
          className={cn(secondaryButton, "w-full sm:w-auto")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          aria-busy={save.isPending || undefined}
          className={cn(primaryButton, "w-full sm:w-auto")}
        >
          <PendingLabel pending={save.isPending}>Save zone</PendingLabel>
        </button>
      </div>
    </form>
  );
}
