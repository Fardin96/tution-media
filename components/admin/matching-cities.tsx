"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { card, primaryButton } from "@/components/profile/styles";
import { enterClass, enterStyle } from "@/components/motion/enter";
import {
  Field,
  QueryState,
  Section,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import { ToggleSwitch } from "@/components/admin/matching-ui";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  areaText,
  readBoundary,
  readFileText,
  useCities,
  useMatchingDistricts,
  useUpdateCity,
  useUpsertCity,
  validateCityName,
  validateCitySlug,
  issueFields,
  type AdminCity,
  type CityBoundary,
  type CityUpsertBody,
} from "@/lib/admin-matching";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

type District = { code: string; name: string };

export function CitiesTab({ canEdit }: { canEdit: boolean }) {
  const cities = useCities();
  const districts = useMatchingDistricts();
  const rows = cities.data?.cities ?? [];
  const districtName = (code: string) =>
    districts.data?.find((d) => d.code === code)?.name ?? code;

  return (
    <div className="flex flex-col gap-4">
      <QueryState
        query={cities}
        isEmpty={rows.length === 0}
        loadingLabel="Loading cities"
        errorText="Couldn't load cities."
        emptyText="No cities yet."
      >
        <ul className="grid gap-4">
          {rows.map((city, i) => (
            <li key={city.slug} className={enterClass} style={enterStyle(i)}>
              <CityRow
                city={city}
                district={districtName(city.districtCode)}
                canEdit={canEdit}
              />
            </li>
          ))}
        </ul>
      </QueryState>

      {canEdit && <CityForm districts={districts.data ?? []} />}
    </div>
  );
}

function CityRow({
  city,
  district,
  canEdit,
}: {
  city: AdminCity;
  district: string;
  canEdit: boolean;
}) {
  const update = useUpdateCity();
  return (
    <div
      className={cn(
        card,
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-5",
      )}
    >
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
          {city.name}
        </p>
        <p className="text-sm break-words text-[var(--color-text-secondary)]">
          {district} · <span className="font-mono">{city.slug}</span> ·{" "}
          <span className="tabular-nums">{areaText(city.areaKm2)}</span>
        </p>
      </div>

      {canEdit ? (
        <div className="min-w-40">
          <ToggleSwitch
            label="Active"
            on={city.isActive}
            pending={update.isPending}
            onChange={(isActive) =>
              update.mutate(
                { slug: city.slug, isActive },
                {
                  onSuccess: () =>
                    toastSuccess(
                      isActive ? "City turned on." : "City turned off.",
                    ),
                  onError: (err) =>
                    toastError("Couldn't update the city.", err),
                },
              )
            }
          />
        </div>
      ) : (
        <StatusPill tone={city.isActive ? "success" : "neutral"}>
          {city.isActive ? "Active" : "Inactive"}
        </StatusPill>
      )}
    </div>
  );
}

type CityErrors = Partial<
  Record<"slug" | "name" | "districtCode" | "boundary", string>
>;

function CityForm({ districts }: { districts: District[] }) {
  const upsert = useUpsertCity();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<CityErrors>({});
  const [formError, setFormError] = useState<string>();
  const [fileKey, setFileKey] = useState(0);

  function reset() {
    setSlug("");
    setName("");
    setDistrictCode("");
    setFile(null);
    setFileKey((n) => n + 1);
    setErrors({});
    setFormError(undefined);
  }

  function rejected(err: unknown) {
    if (err instanceof ApiError && err.status === 400 && err.issues?.length) {
      const fields = issueFields(err.issues);
      const next: CityErrors = {
        slug: fields.slug,
        name: fields.name,
        districtCode: fields.districtCode,
        boundary: fields.boundary,
      };
      setErrors(next);
      const unplaced = Object.entries(fields).find(
        ([key]) => !["slug", "name", "districtCode", "boundary"].includes(key),
      );
      setFormError(unplaced?.[1]);
      return;
    }
    toastError("Couldn't save the city.", err);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (upsert.isPending) return;
    setFormError(undefined);
    const next: CityErrors = {
      slug: validateCitySlug(slug),
      name: validateCityName(name),
      districtCode: districtCode ? undefined : "Choose a district.",
      boundary: file ? undefined : "Choose a GeoJSON file.",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !file) return;

    let boundary: CityBoundary;
    try {
      const parsed = readBoundary(await readFileText(file));
      if (!parsed.ok) {
        setErrors({ boundary: parsed.message });
        return;
      }
      boundary = parsed.boundary;
    } catch {
      setErrors({ boundary: "Couldn't read that file." });
      return;
    }

    const body: CityUpsertBody = {
      name: name.trim(),
      districtCode: districtCode as CityUpsertBody["districtCode"],
      boundary,
    };
    upsert.mutate(
      { slug: slug.trim(), body },
      {
        onSuccess: (city) => {
          toastSuccess(`${city.name} saved.`);
          reset();
        },
        onError: rejected,
      },
    );
  }

  return (
    <Section title="Add or replace a city">
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Slug"
            hint="Lowercase letters, digits and dashes. An existing slug is replaced."
            error={errors.slug}
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setErrors((x) => ({ ...x, slug: undefined }));
                }}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(inputClass, "font-mono text-sm")}
              />
            )}
          </Field>
          <Field label="Name" error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((x) => ({ ...x, name: undefined }));
                }}
                autoComplete="off"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={inputClass}
              />
            )}
          </Field>
        </div>

        <Field label="District" error={errors.districtCode}>
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              value={districtCode}
              onChange={(e) => {
                setDistrictCode(e.target.value);
                setErrors((x) => ({ ...x, districtCode: undefined }));
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            >
              <option value="">Choose a district</option>
              {districts.map((district) => (
                <option key={district.code} value={district.code}>
                  {district.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label="Boundary (GeoJSON)"
          hint="A Polygon or MultiPolygon, or a Feature or FeatureCollection with one feature."
          error={errors.boundary}
        >
          {({ id, describedBy, invalid }) => (
            <input
              key={fileKey}
              id={id}
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErrors((x) => ({ ...x, boundary: undefined }));
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(
                inputClass,
                "py-2 text-sm file:me-3 file:min-h-9 file:rounded-full file:border-0 file:bg-[var(--color-secondary-sky)] file:px-4 file:text-sm file:font-semibold file:text-[var(--color-primary-deep)]",
              )}
            />
          )}
        </Field>

        {formError && (
          <p
            role="alert"
            className="text-sm font-medium text-[var(--color-semantic-error-text)]"
          >
            {formError}
          </p>
        )}

        <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
          Boundaries from OpenStreetMap need the credit © OpenStreetMap
          contributors.
        </p>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={upsert.isPending}
            aria-busy={upsert.isPending || undefined}
            className={cn(primaryButton, "min-h-11 w-full sm:w-auto")}
          >
            <PendingLabel pending={upsert.isPending}>Save city</PendingLabel>
          </button>
        </div>
      </form>
    </Section>
  );
}
