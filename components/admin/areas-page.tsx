"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  DialogActions,
  Field,
  FilterChips,
  QueryState,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import { enterClass, enterStyle } from "@/components/motion/enter";
import {
  useAdminAreas,
  useCreateArea,
  useUpdateArea,
  validateAreaName,
  type AdminArea,
  type AdminAreaDistrict,
  type AreaFields,
  type AreaFilters,
} from "@/lib/admin-areas";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

type StatusFilter = AreaFilters["status"];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Retired" },
  { value: "all", label: "All" },
];

type DialogState = { mode: "create" } | { mode: "rename"; area: AdminArea };

export function AreasPage() {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [districtCode, setDistrictCode] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [retireTarget, setRetireTarget] = useState<AdminArea | null>(null);
  const [retireOpen, setRetireOpen] = useState(false);

  // Waits for a pause in typing before the list refetches.
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const areas = useAdminAreas({
    districtCode: districtCode || undefined,
    q: q || undefined,
    status,
  });
  const list = areas.data?.areas ?? [];
  const districts = areas.data?.districts ?? [];

  function openRetire(area: AdminArea) {
    setRetireTarget(area);
    setRetireOpen(true);
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Areas"
      description="Areas students and tutors pick on their profiles. Retire an area to hide it from new picks; anyone already using it keeps it."
      actions={
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className={cn(primaryButton, "min-h-11")}
        >
          New area
        </button>
      }
    >
      <div className="grid gap-6">
        <div className="grid gap-3">
          <FilterChips
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
          <div className="flex flex-wrap gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <Field label="Search">
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-describedby={describedBy}
                    placeholder="Area name"
                    autoComplete="off"
                    className={inputClass}
                  />
                )}
              </Field>
            </div>
            <div className="min-w-0 flex-1 basis-64">
              <Field label="District">
                {({ id, describedBy }) => (
                  <select
                    id={id}
                    value={districtCode}
                    onChange={(event) => setDistrictCode(event.target.value)}
                    aria-describedby={describedBy}
                    className={inputClass}
                  >
                    <option value="">All districts</option>
                    <DistrictOptions districts={districts} />
                  </select>
                )}
              </Field>
            </div>
          </div>
        </div>

        <QueryState
          query={areas}
          isEmpty={list.length === 0}
          loadingLabel="Loading areas"
          errorText="Couldn't load areas."
          emptyText="No areas match these filters."
        >
          <ul className="grid gap-3">
            {list.map((area, index) => (
              <AreaRow
                key={area.id}
                area={area}
                onRename={() => setDialog({ mode: "rename", area })}
                onRetire={() => openRetire(area)}
                className={enterClass}
                style={enterStyle(index)}
              />
            ))}
          </ul>
        </QueryState>
      </div>

      <AreaDialog
        state={dialog}
        districts={districts}
        onClose={() => setDialog(null)}
      />
      <RetireDialog
        area={retireTarget}
        open={retireOpen}
        onClose={() => setRetireOpen(false)}
      />
    </AdminPage>
  );
}

function AreaRow({
  area,
  onRename,
  onRetire,
  className,
  style,
}: {
  area: AdminArea;
  onRename: () => void;
  onRetire: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const restore = useUpdateArea();
  const restoring = restore.isPending;

  function onRestore() {
    restore.mutate(
      { id: area.id, body: { isActive: true } },
      {
        onSuccess: () => toastSuccess("Area restored"),
        onError: (err) => toastError("Couldn't restore this area.", err),
      },
    );
  }

  return (
    <li
      className={cn(
        card,
        "flex flex-wrap items-center justify-between gap-4 p-5",
        className,
      )}
      style={style}
    >
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {area.name}
          </p>
          {!area.isActive && <StatusPill tone="neutral">Retired</StatusPill>}
        </div>
        <p className="text-sm break-words text-[var(--color-text-secondary)]">
          {area.district} · {area.division}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {usageText(area)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRename}
          aria-label={`Rename ${area.name}`}
          className={cn(secondaryButton, "min-h-11")}
        >
          Rename
        </button>
        {area.isActive ? (
          <button
            type="button"
            onClick={onRetire}
            aria-label={`Retire ${area.name}`}
            className={cn(secondaryButton, "min-h-11")}
          >
            Retire
          </button>
        ) : (
          <button
            type="button"
            onClick={onRestore}
            disabled={restoring}
            aria-busy={restoring || undefined}
            aria-label={`Restore ${area.name}`}
            className={cn(secondaryButton, "min-h-11")}
          >
            <PendingLabel pending={restoring}>Restore</PendingLabel>
          </button>
        )}
      </div>
    </li>
  );
}

function AreaDialog({
  state,
  districts,
  onClose,
}: {
  state: DialogState | null;
  districts: AdminAreaDistrict[];
  onClose: () => void;
}) {
  const create = useCreateArea();
  const update = useUpdateArea();
  const saving = create.isPending || update.isPending;

  return (
    <AdminDialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      busy={saving}
      title={state?.mode === "rename" ? "Rename area" : "New area"}
    >
      {state && (
        <AreaForm
          key={state.mode === "rename" ? state.area.id : "create"}
          state={state}
          districts={districts}
          saving={saving}
          onCancel={onClose}
          onSubmit={(fields, onError) => {
            if (state.mode === "rename") {
              // The district can't change, so a rename sends only the name.
              update.mutate(
                { id: state.area.id, body: { name: fields.name } },
                {
                  onSuccess: () => {
                    toastSuccess("Area renamed");
                    onClose();
                  },
                  onError,
                },
              );
              return;
            }
            create.mutate(fields, {
              onSuccess: () => {
                toastSuccess("Area added");
                onClose();
              },
              onError,
            });
          }}
        />
      )}
    </AdminDialog>
  );
}

function AreaForm({
  state,
  districts,
  saving,
  onCancel,
  onSubmit,
}: {
  state: DialogState;
  districts: AdminAreaDistrict[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (fields: AreaFields, onError: (err: unknown) => void) => void;
}) {
  const area = state.mode === "rename" ? state.area : null;
  const [districtCode, setDistrictCode] = useState("");
  const [name, setName] = useState(area?.name ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [serverNameError, setServerNameError] = useState<string>();

  const districtError =
    !area && submitted && districtCode === ""
      ? "Choose a district."
      : undefined;
  const nameError =
    serverNameError ?? (submitted ? validateAreaName(name) : undefined);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (!area && districtCode === "") return;
    if (validateAreaName(name)) return;
    onSubmit({ districtCode, name: name.trim() }, (err) => {
      // A name taken in this district is shown on the field, so the user can change it.
      if (err instanceof ApiError && err.code === "AREA_EXISTS") {
        setServerNameError(errorCodeMessage(err));
        return;
      }
      toastError(
        area ? "Couldn't rename this area." : "Couldn't add the area.",
        err,
      );
    });
  }

  return (
    <form noValidate onSubmit={onFormSubmit}>
      <div className="grid gap-4">
        {!area && (
          <Field label="District" error={districtError}>
            {({ id, describedBy, invalid }) => (
              <select
                id={id}
                value={districtCode}
                onChange={(event) => {
                  setDistrictCode(event.target.value);
                  setServerNameError(undefined);
                }}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={inputClass}
              >
                <option value="" disabled>
                  Choose a district
                </option>
                <DistrictOptions districts={districts} />
              </select>
            )}
          </Field>
        )}

        <Field
          label="Name"
          hint={area ? "District and division can't change." : undefined}
          error={nameError}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={name}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
                setServerNameError(undefined);
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className={cn(primaryButton, "min-h-11 sm:min-w-36")}
        >
          <PendingLabel pending={saving}>
            {area ? "Save changes" : "Add area"}
          </PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

function RetireDialog({
  area,
  open,
  onClose,
}: {
  area: AdminArea | null;
  open: boolean;
  onClose: () => void;
}) {
  const retire = useUpdateArea();
  const retiring = retire.isPending;

  function onRetire() {
    if (!area || retiring) return;
    retire.mutate(
      { id: area.id, body: { isActive: false } },
      {
        onSuccess: () => {
          toastSuccess("Area retired");
          onClose();
        },
        onError: (err) => toastError("Couldn't retire this area.", err),
      },
    );
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      busy={retiring}
      title={area ? `Retire ${area.name}?` : "Retire area?"}
      description={
        area
          ? `It disappears from area pickers. ${retireImpact(area)}`
          : undefined
      }
    >
      <DialogActions>
        <button
          type="button"
          onClick={onClose}
          disabled={retiring}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRetire}
          disabled={retiring}
          aria-busy={retiring || undefined}
          className={cn(primaryButton, "min-h-11 sm:min-w-36")}
        >
          <PendingLabel pending={retiring}>Retire area</PendingLabel>
        </button>
      </DialogActions>
    </AdminDialog>
  );
}

/** Districts under their division headings. The list arrives sorted by division, so each heading is one run. */
function DistrictOptions({ districts }: { districts: AdminAreaDistrict[] }) {
  const divisions = [
    ...new Set(districts.map((district) => district.division)),
  ];
  return (
    <>
      {divisions.map((division) => (
        <optgroup key={division} label={division}>
          {districts
            .filter((district) => district.division === division)
            .map((district) => (
              <option key={district.code} value={district.code}>
                {district.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

/** Who keeps the area after it is retired. */
function retireImpact(area: AdminArea): string {
  if (area.tutorCount + area.studentCount + area.requirementCount === 0)
    return "Nobody uses it yet.";
  return `${usageText(area, ", ")} keep it.`;
}

function usageText(area: AdminArea, separator = " · "): string {
  return [
    plural(area.tutorCount, "tutor"),
    plural(area.studentCount, "student"),
    plural(area.requirementCount, "requirement"),
  ].join(separator);
}

function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}
