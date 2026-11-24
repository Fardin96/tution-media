"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdminMe } from "@/lib/admin";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { Chip, FieldError } from "@/components/profile/profile-fields";
import {
  AdminDialog,
  AdminPage,
  DialogActions,
  Field,
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import { PendingLabel } from "@/components/ui/pending-label";
import { Skeleton } from "@/components/ui/skeleton";
import { enterClass, enterStyle } from "@/components/motion/enter";
import {
  INSTITUTION_KINDS,
  NAME_MAX,
  institutionDetails,
  parseAliases,
  validateAliases,
  validateName,
  useAdminInstitutions,
  useCreateInstitution,
  useUpdateInstitution,
  KIND_LABEL,
  type AdminInstitution,
  type InstitutionFields,
  type InstitutionFilters,
  type InstitutionKind,
} from "@/lib/institutions";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

const PATH = "/dashboard/admin/institutions";
const PLACE_MAX = 60;
const SEARCH_DEBOUNCE_MS = 300;

type KindFilter = "ALL" | InstitutionKind;
type StatusFilter = "active" | "hidden" | "all";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNIVERSITY", label: "Universities" },
  { value: "COLLEGE", label: "Colleges" },
  { value: "SCHOOL", label: "Schools" },
  { value: "SCHOOL_AND_COLLEGE", label: "School and college" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "hidden", label: "Hidden" },
  { value: "all", label: "All" },
];

// The URL says "hidden"; the API says "inactive".
const API_STATUS: Record<StatusFilter, InstitutionFilters["status"]> = {
  active: "active",
  hidden: "inactive",
  all: "all",
};

function parseKind(value: string | null): KindFilter {
  return INSTITUTION_KINDS.find((kind) => kind === value) ?? "ALL";
}

function parseStatus(value: string | null): StatusFilter {
  return value === "hidden" || value === "all" ? value : "active";
}

type DialogState =
  { mode: "create" } | { mode: "edit"; institution: AdminInstitution };

export function InstitutionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const me = useAdminMe();
  const isSuperAdmin = me.isSuperAdmin;

  const q = searchParams.get("q") ?? "";
  const kind = parseKind(searchParams.get("kind"));
  const status = parseStatus(searchParams.get("status"));
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [draft, setDraft] = useState(q);

  /** Writes the filters to the URL. Defaults are left out, so a cleared search drops `q`. */
  const update = useCallback(
    (next: { q?: string; kind?: KindFilter; status?: StatusFilter }) => {
      const params = new URLSearchParams();
      const nextQ = next.q ?? q;
      const nextKind = next.kind ?? kind;
      const nextStatus = next.status ?? status;
      if (nextQ) params.set("q", nextQ);
      if (nextKind !== "ALL") params.set("kind", nextKind);
      if (nextStatus !== "active") params.set("status", nextStatus);
      const query = params.toString();
      router.replace(query ? `${PATH}?${query}` : PATH, { scroll: false });
    },
    [q, kind, status, router],
  );

  // Waits for a pause in typing before the URL, and so the list, changes.
  useEffect(() => {
    if (draft.trim() === q) return;
    const timer = setTimeout(
      () => update({ q: draft.trim() }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [draft, q, update]);

  // Disabled until the role is known to be super admin, so nothing is requested otherwise.
  const institutions = useAdminInstitutions(
    {
      q: q || undefined,
      kind: kind === "ALL" ? undefined : kind,
      status: API_STATUS[status],
    },
    isSuperAdmin,
  );
  const rows =
    institutions.data?.pages.flatMap((page) => page.institutions) ?? [];
  const total = institutions.data?.pages[0]?.total;
  const filtered = q !== "" || kind !== "ALL" || status !== "active";

  const header = {
    back: { href: "/dashboard/admin", label: "Admin" },
    title: "Schools and universities",
    description:
      "The list people pick from on their profile and requirements. Hidden ones stay on profiles that already use them.",
  };

  if (me.isPending) {
    return (
      <AdminPage {...header}>
        <div role="status" className="grid gap-4">
          <span className="sr-only">Loading schools and universities</span>
          <div
            aria-hidden="true"
            className={cn(card, "flex flex-col gap-3 p-5 sm:p-6")}
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </AdminPage>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AdminPage {...header}>
        <div
          className={cn(
            card,
            "p-6 text-center text-sm text-pretty text-[var(--color-text-secondary)]",
          )}
        >
          Only a super admin can manage schools and universities.
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      {...header}
      actions={
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className={cn(primaryButton, "min-h-11")}
        >
          Add
        </button>
      }
    >
      <div className="grid gap-3">
        <div className="min-w-0 basis-64">
          <Field label="Search" hint="Name, short name or EIIN">
            {({ id, describedBy }) => (
              <input
                id={id}
                type="search"
                value={draft}
                maxLength={60}
                onChange={(event) => setDraft(event.target.value)}
                aria-describedby={describedBy}
                autoComplete="off"
                className={inputClass}
              />
            )}
          </Field>
        </div>
        <FilterChips
          label="Type"
          value={kind}
          options={KIND_OPTIONS}
          onChange={(value) => update({ kind: value })}
        />
        <FilterChips
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => update({ status: value })}
        />
      </div>

      {total !== undefined && (
        <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {`${total.toLocaleString("en-BD")} on the list`}
        </p>
      )}

      <QueryState
        query={institutions}
        isEmpty={rows.length === 0}
        loadingLabel="Loading schools and universities"
        errorText="Couldn't load schools and universities."
        emptyText={
          filtered
            ? "No schools or universities match these filters."
            : "Nothing on the list yet. Add the first one."
        }
      >
        <ul className="grid gap-3">
          {rows.map((institution, index) => (
            <InstitutionRow
              key={institution.id}
              institution={institution}
              onEdit={() => setDialog({ mode: "edit", institution })}
              className={enterClass}
              style={enterStyle(index, 50)}
            />
          ))}
        </ul>
        <LoadMore query={institutions} />
      </QueryState>

      <InstitutionDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminPage>
  );
}

function InstitutionRow({
  institution,
  onEdit,
  className,
  style,
}: {
  institution: AdminInstitution;
  onEdit: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const toggle = useUpdateInstitution();
  const toggling = toggle.isPending && toggle.variables?.id === institution.id;
  const { name, isActive } = institution;

  function onToggle() {
    toggle.mutate(
      { id: institution.id, body: { isActive: !isActive } },
      {
        onSuccess: () =>
          toastSuccess(isActive ? "Hidden from the list" : "Back on the list"),
        onError: (err) =>
          toastError("Couldn't update this school or university.", err),
      },
    );
  }

  const details = institutionDetails(institution);
  const usage = usageText(institution);

  return (
    <li
      className={cn(
        card,
        "flex flex-wrap items-start justify-between gap-4 p-5",
        className,
      )}
      style={style}
    >
      <div className="grid min-w-0 flex-1 basis-64 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {name}
          </p>
          {!isActive && <StatusPill tone="neutral">Hidden</StatusPill>}
        </div>
        <p className="text-sm break-words text-[var(--color-text-secondary)]">
          {details}
        </p>
        {institution.aliases.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Short names">
            {institution.aliases.map((alias) => (
              <li
                key={alias}
                className="rounded-full bg-[var(--color-neutral-off-white)] px-2.5 py-0.5 text-xs text-[var(--color-neutral-charcoal)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
              >
                {alias}
              </li>
            ))}
          </ul>
        )}
        {usage && (
          <p className="pt-1 text-xs text-[var(--color-text-secondary)] tabular-nums">
            {usage}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${name}`}
          className={cn(secondaryButton, "min-h-11")}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          aria-busy={toggling || undefined}
          aria-label={`${isActive ? "Hide" : "Show"} ${name}`}
          className={cn(secondaryButton, "min-h-11")}
        >
          <PendingLabel pending={toggling}>
            {isActive ? "Hide" : "Show"}
          </PendingLabel>
        </button>
      </div>
    </li>
  );
}

function InstitutionDialog({
  state,
  onClose,
}: {
  state: DialogState | null;
  onClose: () => void;
}) {
  const create = useCreateInstitution();
  const update = useUpdateInstitution();
  const saving = create.isPending || update.isPending;

  return (
    <AdminDialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      busy={saving}
      title={
        state?.mode === "edit"
          ? "Edit school or university"
          : "Add school or university"
      }
    >
      {state && (
        <InstitutionForm
          key={state.mode === "edit" ? state.institution.id : "create"}
          institution={state.mode === "edit" ? state.institution : null}
          saving={saving}
          onCancel={onClose}
          onSubmit={(fields, onError) => {
            if (state.mode === "edit") {
              update.mutate(
                { id: state.institution.id, body: fields },
                {
                  onSuccess: () => {
                    toastSuccess("Saved");
                    onClose();
                  },
                  onError,
                },
              );
              return;
            }
            create.mutate(fields, {
              onSuccess: () => {
                toastSuccess("Added");
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

type FieldName = "name" | "kind" | "district" | "area" | "aliases";

function InstitutionForm({
  institution,
  saving,
  onCancel,
  onSubmit,
}: {
  institution: AdminInstitution | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (
    fields: InstitutionFields,
    onError: (err: unknown) => void,
  ) => void;
}) {
  const [name, setName] = useState(institution?.name ?? "");
  const [kind, setKind] = useState<InstitutionKind | null>(
    institution?.kind ?? null,
  );
  const [area, setArea] = useState(institution?.area ?? "");
  const [district, setDistrict] = useState(institution?.district ?? "");
  const [aliases, setAliases] = useState(institution?.aliases.join(", ") ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});

  const names = parseAliases(aliases);
  const clientErrors: Record<FieldName, string | undefined> = {
    name: validateName(name),
    kind: kind === null ? "Choose a type." : undefined,
    area:
      area.trim().length > PLACE_MAX
        ? `Use ${PLACE_MAX} characters or fewer.`
        : undefined,
    district:
      district.trim().length > PLACE_MAX
        ? `Use ${PLACE_MAX} characters or fewer.`
        : undefined,
    aliases: validateAliases(names),
  };
  const messageFor = (field: FieldName) =>
    serverErrors[field] ?? (submitted ? clientErrors[field] : undefined);

  function clearServerError(field: FieldName) {
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (Object.values(clientErrors).some(Boolean) || kind === null) return;
    onSubmit(
      {
        name: name.trim(),
        kind,
        district: district.trim() || null,
        area: area.trim() || null,
        aliases: names,
      },
      (err) => {
        // A name already on the list is shown on the name field; other 400 issues go to their fields.
        if (err instanceof ApiError && err.code === "INSTITUTION_EXISTS") {
          setServerErrors({ name: errorCodeMessage(err) });
          return;
        }
        const issues = err instanceof ApiError ? (err.issues ?? []) : [];
        const next: Partial<Record<FieldName, string>> = {};
        for (const issue of issues) {
          const field = issue.path[0];
          if (
            field === "name" ||
            field === "kind" ||
            field === "district" ||
            field === "area" ||
            field === "aliases"
          )
            next[field] = issue.message;
        }
        if (Object.keys(next).length > 0) setServerErrors(next);
        else toastError("Couldn't save the school or university.", err);
      },
    );
  }

  return (
    <form noValidate onSubmit={onFormSubmit}>
      <div className="grid gap-5">
        <Field label="Name" error={messageFor("name")}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={name}
              maxLength={NAME_MAX}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                clearServerError("name");
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            />
          )}
        </Field>

        <fieldset
          aria-describedby={
            messageFor("kind") ? "institution-kind-error" : undefined
          }
          aria-invalid={messageFor("kind") ? true : undefined}
          className="grid gap-3"
        >
          <legend className="mb-1 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
            Type
          </legend>
          <div className="flex flex-wrap gap-2">
            {INSTITUTION_KINDS.map((option) => (
              <Chip
                key={option}
                type="radio"
                name="institution-kind"
                label={KIND_LABEL[option]}
                checked={kind === option}
                onChange={() => {
                  setKind(option);
                  clearServerError("kind");
                }}
              />
            ))}
          </div>
          <FieldError
            id="institution-kind-error"
            message={messageFor("kind")}
          />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area (optional)" error={messageFor("area")}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                value={area}
                maxLength={PLACE_MAX}
                autoComplete="off"
                onChange={(e) => {
                  setArea(e.target.value);
                  clearServerError("area");
                }}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="District (optional)" error={messageFor("district")}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                value={district}
                maxLength={PLACE_MAX}
                autoComplete="off"
                onChange={(e) => {
                  setDistrict(e.target.value);
                  clearServerError("district");
                }}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={inputClass}
              />
            )}
          </Field>
        </div>

        <Field
          label="Short names (optional)"
          hint="Abbreviations and nicknames people search with, like DU or VNSC."
          error={messageFor("aliases")}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={aliases}
              autoComplete="off"
              placeholder="DU, Dhaka University"
              onChange={(e) => {
                setAliases(e.target.value);
                clearServerError("aliases");
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
            {institution ? "Save changes" : "Add"}
          </PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

/** "Used by 3 tutors · 2 requirements", or null when nothing uses it yet. */
function usageText(institution: AdminInstitution): string | null {
  if (institution.tutorCount + institution.requirementCount === 0) return null;
  return `Used by ${plural(institution.tutorCount, "tutor")} · ${plural(institution.requirementCount, "requirement")}`;
}

function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}
