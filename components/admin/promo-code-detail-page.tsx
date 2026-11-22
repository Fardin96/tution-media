"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  DetailList,
  DialogActions,
  Field,
  QueryState,
  Section,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import {
  DESCRIPTION_MAX,
  PER_TUTOR_MAX,
  TOTAL_USES_MAX,
  serverFieldErrors,
  usedText,
  wholeNumberError,
} from "@/components/admin/promo-codes-page";
import {
  PROMO_STATE_META,
  discountText,
  promoState,
  useAdminPromoCode,
  useUpdatePromoCode,
  type AdminPromoCodeDetail,
  type AdminPromoRedemption,
  type UpdatePromoCodeBody,
} from "@/lib/admin-promo-codes";
import { formatAmount, formatDateTime, useAdminMe } from "@/lib/admin";
import {
  adminFeeQueryOptions,
  localDateTimeToIso,
  localDateTimeValue,
} from "@/lib/admin-fees";
import { useIntentPrefetch } from "@/lib/prefetch";
import { toastError } from "@/lib/toast";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";

export function AdminPromoCodeDetailPage({ id }: { id: string }) {
  const query = useAdminPromoCode(id);
  const update = useUpdatePromoCode(id);
  const admin = useAdminMe();
  const [editOpen, setEditOpen] = useState(false);

  const promo = query.data;
  const isSuperAdmin = admin.isSuperAdmin;

  function toggleActive(next: boolean) {
    update.mutate(
      { isActive: next },
      {
        onSuccess: () =>
          toast.success(next ? "Code turned on." : "Code turned off."),
        onError: (err) =>
          toastError(
            next ? "Couldn't turn the code on." : "Couldn't turn the code off.",
            err,
          ),
      },
    );
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/promo-codes", label: "Promo codes" }}
      title="Promo code"
      description={promo && <PromoHeader promo={promo} />}
      actions={
        promo && isSuperAdmin ? (
          <>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={cn(secondaryButton, "min-h-11")}
            >
              Edit
            </button>
            {promo.isActive ? (
              <button
                type="button"
                onClick={() => toggleActive(false)}
                disabled={update.isPending}
                aria-busy={update.isPending || undefined}
                className={cn(
                  secondaryButton,
                  "min-h-11 text-[var(--color-semantic-error-text)]",
                )}
              >
                <PendingLabel pending={update.isPending}>Turn off</PendingLabel>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toggleActive(true)}
                disabled={update.isPending}
                aria-busy={update.isPending || undefined}
                className={cn(primaryButton, "min-h-11")}
              >
                <PendingLabel pending={update.isPending}>Turn on</PendingLabel>
              </button>
            )}
          </>
        ) : undefined
      }
    >
      <QueryState
        query={query}
        isEmpty={!promo}
        loadingLabel="Loading promo code"
        errorText="Couldn't load this promo code."
        emptyText="This promo code could not be found."
        skeletonCount={2}
      >
        {promo && (
          <>
            <Section title="Details">
              <DetailList
                items={[
                  { label: "Description", value: promo.description },
                  {
                    label: "Starts",
                    value: promo.startsAt
                      ? formatDateTime(promo.startsAt)
                      : "Right away",
                  },
                  {
                    label: "Ends",
                    value: promo.endsAt
                      ? formatDateTime(promo.endsAt)
                      : "No end date",
                  },
                  {
                    label: "Total uses",
                    value:
                      promo.maxRedemptions === null
                        ? "No limit"
                        : String(promo.maxRedemptions),
                  },
                  { label: "Used", value: String(promo.redemptionCount) },
                  {
                    label: "Uses per tutor",
                    value: String(promo.maxPerTutor),
                  },
                  { label: "Created by", value: promo.createdByName },
                  { label: "Created", value: formatDateTime(promo.createdAt) },
                ]}
              />
            </Section>

            <Section title="Redemptions">
              {promo.redemptions.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No one has used this code yet.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {promo.redemptions.map((redemption) => (
                    <RedemptionRow
                      key={redemption.id}
                      redemption={redemption}
                    />
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </QueryState>

      {promo && isSuperAdmin && (
        <AdminDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          busy={update.isPending}
          title="Edit promo code"
          description="Discount terms can't change. Create a new code instead."
        >
          {editOpen && (
            <EditPromoForm
              promo={promo}
              saving={update.isPending}
              onCancel={() => setEditOpen(false)}
              onSubmit={(body, onError) =>
                update.mutate(body, {
                  onSuccess: () => {
                    toast.success("Promo code updated.");
                    setEditOpen(false);
                  },
                  onError,
                })
              }
            />
          )}
        </AdminDialog>
      )}
    </AdminPage>
  );
}

function PromoHeader({ promo }: { promo: AdminPromoCodeDetail }) {
  const meta = PROMO_STATE_META[promoState(promo)];
  return (
    <>
      <span className="block font-mono text-sm font-semibold break-all text-[var(--color-neutral-charcoal)]">
        {promo.code}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        <span className="font-medium tabular-nums">
          {discountText(promo, formatAmount)}
        </span>
        <span className="tabular-nums">{usedText(promo)}</span>
      </span>
    </>
  );
}

function RedemptionRow({ redemption }: { redemption: AdminPromoRedemption }) {
  const active = redemption.status === "ACTIVE";
  const intent = useIntentPrefetch();
  return (
    <li className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {redemption.tutor.name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] tabular-nums">
            {formatDateTime(redemption.createdAt)}
          </p>
        </div>
        <Link
          href={`/dashboard/admin/fees/${encodeURIComponent(redemption.feeId)}`}
          {...intent(adminFeeQueryOptions(redemption.feeId))}
          className={cn(ghostButton, "min-h-10 px-3")}
        >
          <LinkPendingLabel>Open fee</LinkPendingLabel>
        </Link>
      </div>
      <DetailList
        items={[
          {
            label: "Discount",
            value: formatAmount(redemption.discountAmount),
          },
          {
            label: "Original amount",
            value: formatAmount(redemption.originalAmount),
          },
          {
            label: "Status",
            value: (
              <StatusPill tone={active ? "info" : "neutral"}>
                {active ? "In use" : "Released"}
              </StatusPill>
            ),
          },
        ]}
      />
      {!active && redemption.releaseReason && (
        <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
          {redemption.releaseReason}
        </p>
      )}
    </li>
  );
}

/* ───────── Edit form ───────── */

type EditField = "description" | "endsAt" | "maxRedemptions" | "maxPerTutor";

const EDIT_FIELDS: readonly EditField[] = [
  "description",
  "endsAt",
  "maxRedemptions",
  "maxPerTutor",
];

type EditValues = {
  description: string;
  endsAt: string;
  maxRedemptions: string;
  maxPerTutor: string;
};

function initialEdit(promo: AdminPromoCodeDetail): EditValues {
  return {
    description: promo.description ?? "",
    endsAt: promo.endsAt ? localDateTimeValue(new Date(promo.endsAt)) : "",
    maxRedemptions:
      promo.maxRedemptions === null ? "" : String(promo.maxRedemptions),
    maxPerTutor: String(promo.maxPerTutor),
  };
}

/**
 * Builds the PATCH body from the fields that changed. An empty Ends sends endsAt null and an
 * empty Total uses sends maxRedemptions null. Changed fields that break a rule come back as errors.
 */
function buildEdit(
  promo: AdminPromoCodeDetail,
  values: EditValues,
  now: Date,
): { body: UpdatePromoCodeBody; errors: Partial<Record<EditField, string>> } {
  const body: UpdatePromoCodeBody = {};
  const errors: Partial<Record<EditField, string>> = {};
  const initial = initialEdit(promo);

  const description = values.description.trim();
  if (description !== initial.description.trim()) {
    if (description.length > DESCRIPTION_MAX) {
      errors.description = `Keep the description to ${DESCRIPTION_MAX} characters or fewer.`;
    } else {
      body.description = description === "" ? null : description;
    }
  }

  if (values.endsAt !== initial.endsAt) {
    if (values.endsAt === "") {
      body.endsAt = null;
    } else {
      const iso = localDateTimeToIso(values.endsAt);
      const startsAt = promo.startsAt ? new Date(promo.startsAt) : null;
      if (iso === undefined) errors.endsAt = "Pick a date and time.";
      else if (new Date(iso) <= now) {
        errors.endsAt = "Ends must be in the future.";
      } else if (startsAt && new Date(iso) <= startsAt) {
        errors.endsAt = "Ends must be after the start.";
      } else body.endsAt = iso;
    }
  }

  const total = values.maxRedemptions.trim();
  if (total !== initial.maxRedemptions) {
    if (total === "") {
      body.maxRedemptions = null;
    } else {
      const error = wholeNumberError(
        total,
        TOTAL_USES_MAX,
        "Enter a whole number from 1 to 1,000,000.",
      );
      if (error) errors.maxRedemptions = error;
      else body.maxRedemptions = Number(total);
    }
  }

  const perTutor = values.maxPerTutor.trim();
  if (perTutor !== initial.maxPerTutor) {
    const error = wholeNumberError(
      perTutor,
      PER_TUTOR_MAX,
      "Enter a whole number from 1 to 100.",
    );
    if (error) errors.maxPerTutor = error;
    else body.maxPerTutor = Number(perTutor);
  }

  return { body, errors };
}

function EditPromoForm({
  promo,
  saving,
  onCancel,
  onSubmit,
}: {
  promo: AdminPromoCodeDetail;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (
    body: UpdatePromoCodeBody,
    onError: (err: unknown) => void,
  ) => void;
}) {
  const [values, setValues] = useState<EditValues>(() => initialEdit(promo));
  const [now] = useState(() => new Date());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<EditField, string>>
  >({});

  const { body, errors } = buildEdit(promo, values, now);
  const dirty = Object.keys(body).length > 0 || Object.keys(errors).length > 0;
  const messageFor = (field: EditField) =>
    serverErrors[field] ?? (submitted ? errors[field] : undefined);

  function set(field: EditField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (!dirty || EDIT_FIELDS.some((field) => errors[field])) return;
    onSubmit(body, (err) => {
      const fields = serverFieldErrors(err, EDIT_FIELDS);
      if (fields) setServerErrors(fields);
      else toastError("Couldn't update the promo code.", err);
    });
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <Field label="Description" error={messageFor("description")}>
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

      <Field
        label="Ends"
        hint="Clear the field to remove the end date."
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Total uses"
          hint="Clear the field for no limit."
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
        <Field label="Uses per tutor" error={messageFor("maxPerTutor")}>
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
          disabled={saving || !dirty}
          aria-busy={saving || undefined}
          className={cn(primaryButton, "min-h-11 sm:min-w-36")}
        >
          <PendingLabel pending={saving}>Save changes</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}
