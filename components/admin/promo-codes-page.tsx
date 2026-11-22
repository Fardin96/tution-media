"use client";

import { useState, useId, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
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
import {
  PROMO_STATE_META,
  adminPromoCodeQueryOptions,
  discountText,
  promoState,
  useAdminPromoCodes,
  useCreatePromoCode,
  validateCode,
  type AdminPromoCode,
  type AdminPromoFilters,
  type CreatePromoCodeBody,
  type PromoDiscountType,
} from "@/lib/admin-promo-codes";
import { formatAmount, formatDateTime, useAdminMe } from "@/lib/admin";
import { errorCodeMessage, mapServerIssuesToFields } from "@/lib/api-errors";
import { localDateTimeToIso, parseAmount } from "@/lib/admin-fees";
import { ApiError } from "@/lib/profile";
import { useIntentPrefetch } from "@/lib/prefetch";
import { PendingLabel } from "@/components/ui/pending-label";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { toastError } from "@/lib/toast";

/* ───────── Shared rules (mirror tuition-api's promo schema) ───────── */

export const FLAT_MAX = 5_000_000;
export const DESCRIPTION_MAX = 200;
export const CODE_MAX_LENGTH = 32;
export const TOTAL_USES_MAX = 1_000_000;
export const PER_TUTOR_MAX = 100;

const DECIMAL = /^\d+(\.\d+)?$/;
const WHOLE = /^\d+$/;

/** Inline message for a taka or percent amount: above 0, at most 2 decimals, at most `max`. */
export function moneyError(
  text: string,
  max: number,
  tooBig: string,
): string | undefined {
  const cleaned = text.trim().replace(/,/g, "");
  if (!DECIMAL.test(cleaned) || Number(cleaned) <= 0) {
    return "Enter an amount above 0.";
  }
  if ((cleaned.split(".")[1] ?? "").length > 2) {
    return "Use at most 2 decimal places.";
  }
  if (Number(cleaned) > max) return tooBig;
  return undefined;
}

/** Inline message for a whole number between 1 and `max`, or undefined. */
export function wholeNumberError(
  text: string,
  max: number,
  message: string,
): string | undefined {
  const value = text.trim();
  if (!WHOLE.test(value)) return message;
  const n = Number(value);
  return n >= 1 && n <= max ? undefined : message;
}

/** Inline message for a datetime-local value that must parse, or undefined. */
export function dateTimeError(text: string): string | undefined {
  return localDateTimeToIso(text) === undefined
    ? "Pick a date and time."
    : undefined;
}

/**
 * Maps a 400 from the API onto the form's own fields. Returns null when no issue names one of
 * them, so the caller can fall back to a toast.
 */
export function serverFieldErrors<K extends string>(
  err: unknown,
  fields: readonly K[],
): Partial<Record<K, string>> | null {
  if (!(err instanceof ApiError) || !err.issues) return null;
  const mapped = mapServerIssuesToFields<K>(err.issues);
  const out: Partial<Record<K, string>> = {};
  let matched = false;
  for (const field of fields) {
    const message = mapped[field];
    if (message) {
      out[field] = message;
      matched = true;
    }
  }
  return matched ? out : null;
}

/* ───────── List page ───────── */

type View = "active" | "off" | "all";

const VIEWS: { value: View; label: string; filters: AdminPromoFilters }[] = [
  { value: "active", label: "Active", filters: { active: true } },
  { value: "off", label: "Turned off", filters: { active: false } },
  { value: "all", label: "All", filters: {} },
];

const VIEW_VALUES = new Set<string>(VIEWS.map((v) => v.value));

const EMPTY_TEXT: Record<View, string> = {
  active: "No active codes right now.",
  off: "No codes are turned off.",
  all: "No promo codes yet.",
};

export function AdminPromoCodesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const admin = useAdminMe();
  const create = useCreatePromoCode();
  const [createOpen, setCreateOpen] = useState(false);

  const raw = searchParams.get("view") ?? "active";
  const view: View = VIEW_VALUES.has(raw) ? (raw as View) : "active";
  const filters = VIEWS.find((v) => v.value === view)?.filters ?? {};
  const query = useAdminPromoCodes(filters);
  const codes = query.data?.pages.flatMap((p) => p.promoCodes) ?? [];

  // The view lives in the URL. The default view drops its param so the bare path stays clean.
  function setView(next: View) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "active") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function submitCreate(
    body: CreatePromoCodeBody,
    onError: (err: unknown) => void,
  ) {
    create.mutate(body, {
      onSuccess: (detail) => {
        toast.success("Promo code created.");
        setCreateOpen(false);
        router.push(
          `/dashboard/admin/promo-codes/${encodeURIComponent(detail.id)}`,
        );
      },
      onError,
    });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Promo codes"
      description="Discount codes tutors can use on their fees."
      actions={
        admin.isSuperAdmin ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={cn(primaryButton, "min-h-11")}
          >
            New code
          </button>
        ) : undefined
      }
    >
      <FilterChips
        label="Promo code view"
        value={view}
        options={VIEWS}
        onChange={setView}
      />

      <QueryState
        query={query}
        isEmpty={codes.length === 0}
        loadingLabel="Loading promo codes"
        errorText="Couldn't load promo codes."
        emptyText={EMPTY_TEXT[view]}
      >
        <ul className="grid gap-4">
          {codes.map((promo, index) => (
            <li key={promo.id} className={enterClass} style={enterStyle(index)}>
              <PromoRow promo={promo} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>

      {admin.isSuperAdmin && (
        <AdminDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          busy={create.isPending}
          title="New promo code"
          description="Discount terms can't change after you create the code. Create a new one instead."
        >
          {createOpen && (
            <CreatePromoForm
              saving={create.isPending}
              onCancel={() => setCreateOpen(false)}
              onSubmit={submitCreate}
            />
          )}
        </AdminDialog>
      )}
    </AdminPage>
  );
}

/** "Used 3" or "Used 3 of 100", for the row and the detail page. */
export function usedText(
  promo: Pick<AdminPromoCode, "redemptionCount" | "maxRedemptions">,
) {
  return promo.maxRedemptions === null
    ? `Used ${promo.redemptionCount}`
    : `Used ${promo.redemptionCount} of ${promo.maxRedemptions}`;
}

function PromoRow({ promo }: { promo: AdminPromoCode }) {
  const meta = PROMO_STATE_META[promoState(promo)];
  const intent = useIntentPrefetch();
  const ends = promo.endsAt
    ? `Ends ${formatDateTime(promo.endsAt)}`
    : "No end date";

  return (
    <Link
      href={`/dashboard/admin/promo-codes/${encodeURIComponent(promo.id)}`}
      {...intent(adminPromoCodeQueryOptions(promo.id))}
      className={cn(card, "grid gap-3 p-5", focusRing)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 font-mono font-semibold break-all text-[var(--color-neutral-charcoal)]">
          {promo.code}
        </p>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>
      <p className="text-sm font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
        {discountText(promo, formatAmount)}
      </p>
      <p className="text-xs break-words text-[var(--color-text-secondary)] tabular-nums">
        {usedText(promo)} · {ends}
      </p>
    </Link>
  );
}

/* ───────── Create form ───────── */

export type CreateField =
  | "code"
  | "description"
  | "discountValue"
  | "maxDiscount"
  | "startsAt"
  | "endsAt"
  | "maxRedemptions"
  | "maxPerTutor";

const CREATE_FIELDS: readonly CreateField[] = [
  "code",
  "description",
  "discountValue",
  "maxDiscount",
  "startsAt",
  "endsAt",
  "maxRedemptions",
  "maxPerTutor",
];

type CreateValues = {
  code: string;
  description: string;
  discountType: PromoDiscountType;
  discountValue: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  maxPerTutor: string;
};

const EMPTY_CREATE: CreateValues = {
  code: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  maxPerTutor: "1",
};

const DISCOUNT_TYPES: { value: PromoDiscountType; label: string }[] = [
  { value: "PERCENT", label: "Percent off" },
  { value: "FLAT", label: "Taka off" },
];

type Errors<K extends string> = Partial<Record<K, string | undefined>>;

function validateCreate(v: CreateValues, now: Date): Errors<CreateField> {
  const percent = v.discountType === "PERCENT";
  const errors: Errors<CreateField> = {};

  errors.code = validateCode(v.code);
  errors.description =
    v.description.trim().length > DESCRIPTION_MAX
      ? `Keep the description to ${DESCRIPTION_MAX} characters or fewer.`
      : undefined;
  errors.discountValue = moneyError(
    v.discountValue,
    percent ? 100 : FLAT_MAX,
    percent
      ? "A percent discount can be at most 100."
      : "Use 5,000,000 or less.",
  );
  if (percent && v.maxDiscount.trim()) {
    errors.maxDiscount = moneyError(
      v.maxDiscount,
      FLAT_MAX,
      "Use 5,000,000 or less.",
    );
  }

  const starts = v.startsAt ? localDateTimeToIso(v.startsAt) : undefined;
  const ends = v.endsAt ? localDateTimeToIso(v.endsAt) : undefined;
  if (v.startsAt) errors.startsAt = dateTimeError(v.startsAt);
  if (v.endsAt) {
    if (ends === undefined) errors.endsAt = "Pick a date and time.";
    else if (new Date(ends) <= now)
      errors.endsAt = "Ends must be in the future.";
    else if (starts && new Date(ends) <= new Date(starts)) {
      errors.endsAt = "Ends must be after the start.";
    }
  }

  if (v.maxRedemptions.trim()) {
    errors.maxRedemptions = wholeNumberError(
      v.maxRedemptions,
      TOTAL_USES_MAX,
      "Enter a whole number from 1 to 1,000,000.",
    );
  }
  errors.maxPerTutor = wholeNumberError(
    v.maxPerTutor,
    PER_TUTOR_MAX,
    "Enter a whole number from 1 to 100.",
  );
  return errors;
}

/** Only the fields the admin filled go out. The code is saved in capitals. */
function buildCreateBody(v: CreateValues): CreatePromoCodeBody {
  const percent = v.discountType === "PERCENT";
  const body: CreatePromoCodeBody = {
    code: v.code.trim().toUpperCase(),
    discountType: v.discountType,
    discountValue: parseAmount(v.discountValue),
    maxPerTutor: Number(v.maxPerTutor.trim()),
  };
  const description = v.description.trim();
  if (description) body.description = description;
  if (percent && v.maxDiscount.trim()) {
    body.maxDiscount = parseAmount(v.maxDiscount);
  }
  const startsAt = v.startsAt ? localDateTimeToIso(v.startsAt) : undefined;
  if (startsAt) body.startsAt = startsAt;
  const endsAt = v.endsAt ? localDateTimeToIso(v.endsAt) : undefined;
  if (endsAt) body.endsAt = endsAt;
  if (v.maxRedemptions.trim()) {
    body.maxRedemptions = Number(v.maxRedemptions.trim());
  }
  return body;
}

function CreatePromoForm({
  saving,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  onCancel: () => void;
  onSubmit: (
    body: CreatePromoCodeBody,
    onError: (err: unknown) => void,
  ) => void;
}) {
  const [values, setValues] = useState<CreateValues>(EMPTY_CREATE);
  const [now] = useState(() => new Date());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors<CreateField>>({});

  const clientErrors = validateCreate(values, now);
  const messageFor = (field: CreateField) =>
    serverErrors[field] ?? (submitted ? clientErrors[field] : undefined);

  function set(field: CreateField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (CREATE_FIELDS.some((field) => clientErrors[field])) return;
    onSubmit(buildCreateBody(values), (err) => {
      const fields = serverFieldErrors(err, CREATE_FIELDS);
      if (fields) {
        setServerErrors(fields);
        return;
      }
      if (err instanceof ApiError && err.code === "PROMO_CODE_EXISTS") {
        setServerErrors({ code: errorCodeMessage(err) });
        return;
      }
      toastError("Couldn't create the promo code.", err);
    });
  }

  const percent = values.discountType === "PERCENT";

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <Field
        label="Code"
        hint="3 to 32 letters, digits, - or _. Saved in capitals."
        error={messageFor("code")}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={values.code}
            onChange={(e) => set("code", e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={CODE_MAX_LENGTH}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "font-mono")}
          />
        )}
      </Field>

      <Field label="Description (optional)" error={messageFor("description")}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            autoComplete="off"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={inputClass}
          />
        )}
      </Field>

      <DiscountTypeField
        value={values.discountType}
        onChange={(next) =>
          setValues((prev) => ({ ...prev, discountType: next }))
        }
      />

      <Field
        label="Value"
        hint={
          percent
            ? "Percent off the fee part. Up to 100."
            : "Taka off the fee part."
        }
        error={messageFor("discountValue")}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={values.discountValue}
            onChange={(e) => set("discountValue", e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "tabular-nums")}
          />
        )}
      </Field>

      {percent && (
        <Field
          label="Max discount (optional)"
          hint="Caps the taka taken off. Leave empty for no cap."
          error={messageFor("maxDiscount")}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.maxDiscount}
              onChange={(e) => set("maxDiscount", e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "tabular-nums")}
            />
          )}
        </Field>
      )}

      <div className="grid gap-5">
        <Field
          label="Starts (optional)"
          hint="Leave empty to start right away."
          error={messageFor("startsAt")}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="datetime-local"
              value={values.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "min-w-0")}
            />
          )}
        </Field>
        <Field
          label="Ends (optional)"
          hint="Leave empty for no end date."
          error={messageFor("endsAt")}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="datetime-local"
              value={values.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "min-w-0")}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Total uses (optional)"
          hint="Leave empty for no limit."
          error={messageFor("maxRedemptions")}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.maxRedemptions}
              onChange={(e) => set("maxRedemptions", e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "tabular-nums")}
            />
          )}
        </Field>
        <Field
          label="Uses per tutor"
          hint="How many times one tutor can use it."
          error={messageFor("maxPerTutor")}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.maxPerTutor}
              onChange={(e) => set("maxPerTutor", e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "tabular-nums")}
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
          <PendingLabel pending={saving}>Create code</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

/** Two radio buttons styled as one segment control, the same pattern as DaysPerWeekField. */
function DiscountTypeField({
  value,
  onChange,
}: {
  value: PromoDiscountType;
  onChange: (value: PromoDiscountType) => void;
}) {
  const labelId = useId();
  return (
    <div className="grid gap-1.5">
      <span
        id={labelId}
        className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
      >
        Type
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-2 gap-1 rounded-full bg-[var(--color-surface-subtle)] p-1"
      >
        {DISCOUNT_TYPES.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-10 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-semibold transition-[background-color,color,scale] duration-150 ease-out select-none active:scale-[0.96] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-primary-core)] motion-reduce:transition-none",
                checked
                  ? "bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-neutral-charcoal)]",
              )}
            >
              <input
                type="radio"
                name={`${labelId}-type`}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
