"use client";

import { useId, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { card, focusRing, primaryButton } from "@/components/profile/styles";
import {
  AdminPage,
  Field,
  QueryState,
  Section,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import { formatDateTime, useAdminMe } from "@/lib/admin";
import {
  useAdminSettings,
  useUpdateSetting,
  validateDays,
  validatePercent,
  type PlatformSetting,
  type SettingKey,
} from "@/lib/admin-settings";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

type NumberInput = { unit: "percent" | "days"; max: number; hint?: string };

/** Display order and copy for each platform setting. `input` marks a number setting and its limits. */
const SETTINGS: {
  key: SettingKey;
  title: string;
  description: string;
  input?: NumberInput;
}[] = [
  {
    key: "commission_percent",
    title: "Commission",
    description:
      "Percent of the monthly salary, or of the package price, charged as a placement fee when an application is confirmed.",
    input: { unit: "percent", max: 100 },
  },
  {
    key: "online_payments_enabled",
    title: "Online payments",
    description:
      "Lets tutors pay placement fees through SSLCommerz. Turn it off to stop new checkouts. Payments already started still finish.",
  },
  {
    key: "gateway_charge_percent",
    title: "Processing charge",
    description:
      "Percent added on top of every online payment to cover SSLCommerz's fee. Tutors see it before they pay. It isn't part of the placement fee and isn't refunded.",
    input: { unit: "percent", max: 10 },
  },
  {
    key: "refund_window_days",
    title: "Refund window",
    description:
      "Refunds of the fee part of online payments. The processing charge is never refunded.",
    input: {
      unit: "days",
      max: 90,
      hint: "Days after an online payment that a tutor can ask for a refund. 0 turns tutor requests off.",
    },
  },
  {
    key: "require_tutor_verification",
    title: "Tutor verification",
    description: "Only verified tutors are listed and can apply.",
  },
  {
    key: "require_phone_verification",
    title: "Phone verification",
    description:
      "Tutors and students need a verified phone number before posting or applying.",
  },
];

export function SettingsPage() {
  const settings = useAdminSettings();
  const me = useAdminMe();
  const canEdit = me.isSuperAdmin;
  const items = settings.data?.settings ?? [];

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Settings"
      description="Changes apply to every new action right away."
    >
      <QueryState
        query={settings}
        isEmpty={items.length === 0}
        loadingLabel="Loading settings"
        errorText="Couldn't load settings."
        emptyText="No settings found."
        skeletonCount={3}
      >
        {me.isSuccess && !canEdit && (
          <p
            className={cn(
              card,
              "p-5 text-sm text-[var(--color-text-secondary)]",
            )}
          >
            Only a super admin can change settings.
          </p>
        )}
        {SETTINGS.map((copy) => {
          const item = items.find((i) => i.key === copy.key);
          if (!item) return null;
          return (
            <SettingSection
              key={copy.key}
              copy={copy}
              item={item}
              canEdit={canEdit}
            />
          );
        })}
      </QueryState>
    </AdminPage>
  );
}

function SettingSection({
  copy,
  item,
  canEdit,
}: {
  copy: (typeof SETTINGS)[number];
  item: PlatformSetting;
  canEdit: boolean;
}) {
  const descriptionId = useId();
  return (
    <Section title={copy.title}>
      <p
        id={descriptionId}
        className="text-sm text-pretty text-[var(--color-text-secondary)]"
      >
        {copy.description}
      </p>

      {copy.input ? (
        // Keyed on the saved value so the field shows the server's number after each save.
        <NumberForm
          key={`${item.value}-${item.updatedAt}`}
          settingKey={item.key}
          input={copy.input}
          value={Number(item.value)}
          canEdit={canEdit}
        />
      ) : (
        <SwitchControl
          item={item}
          title={copy.title}
          descriptionId={descriptionId}
          canEdit={canEdit}
        />
      )}

      <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
        {lastChangedText(item)}
      </p>
    </Section>
  );
}

/** How each kind of number setting reads, validates and shows. */
const UNITS: Record<
  NumberInput["unit"],
  {
    label: string;
    suffix: string;
    suffixPadding: string;
    inputMode: "decimal" | "numeric";
    step: number;
    validate: (text: string, max: number) => string | undefined;
    show: (value: number) => string;
  }
> = {
  percent: {
    label: "Percent",
    suffix: "%",
    suffixPadding: "pe-10",
    inputMode: "decimal",
    step: 0.01,
    validate: validatePercent,
    show: (value) => `${value}%`,
  },
  days: {
    label: "Days",
    suffix: "days",
    suffixPadding: "pe-16",
    inputMode: "numeric",
    step: 1,
    validate: validateDays,
    show: (value) => `${value} ${value === 1 ? "day" : "days"}`,
  },
};

function NumberForm({
  settingKey,
  input,
  value,
  canEdit,
}: {
  settingKey: SettingKey;
  input: NumberInput;
  value: number;
  canEdit: boolean;
}) {
  const unit = UNITS[input.unit];
  const update = useUpdateSetting();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string>();

  if (!canEdit) {
    return (
      <p className="text-2xl font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
        {unit.show(value)}
      </p>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = unit.validate(text, input.max);
    if (message) {
      setError(message);
      return;
    }
    update.mutate(
      { key: settingKey, value: Number(text.trim()) },
      {
        onSuccess: () => toastSuccess("Setting saved"),
        onError: (err) => {
          const issue =
            err instanceof ApiError
              ? err.issues?.find((i) => i.path[0] === "value")?.message
              : undefined;
          if (issue) setError(issue);
          else toastError("Couldn't save the setting.", err);
        },
      },
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <div className="max-w-xs">
        <Field label={unit.label} hint={input.hint} error={error}>
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <input
                id={id}
                type="number"
                inputMode={unit.inputMode}
                step={unit.step}
                min={0}
                max={input.max}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(undefined);
                }}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(inputClass, unit.suffixPadding, "tabular-nums")}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-[var(--color-text-secondary)]"
              >
                {unit.suffix}
              </span>
            </div>
          )}
        </Field>
      </div>
      <button
        type="submit"
        disabled={update.isPending}
        aria-busy={update.isPending || undefined}
        className={cn(primaryButton, "min-h-11 self-start")}
      >
        {update.isPending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function SwitchControl({
  item,
  title,
  descriptionId,
  canEdit,
}: {
  item: PlatformSetting;
  title: string;
  descriptionId: string;
  canEdit: boolean;
}) {
  const update = useUpdateSetting();
  const on = item.value === true;

  if (!canEdit) {
    return (
      <StatusPill tone={on ? "success" : "neutral"}>
        {on ? "On" : "Off"}
      </StatusPill>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={title}
      aria-describedby={descriptionId}
      disabled={update.isPending}
      onClick={() =>
        update.mutate(
          { key: item.key, value: !on },
          {
            onSuccess: () => toastSuccess("Setting saved"),
            onError: (err) => toastError("Couldn't save the setting.", err),
          },
        )
      }
      className={cn(
        "inline-flex min-h-11 items-center gap-3 self-start rounded-full pe-2 text-sm font-semibold text-[var(--color-neutral-charcoal)] transition-[scale] duration-150 ease-out active:scale-[0.96] disabled:opacity-60 motion-reduce:transition-none",
        focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-[background-color] duration-150 ease-out motion-reduce:transition-none",
          on
            ? "bg-[var(--color-primary-core)]"
            : "bg-[var(--color-neutral-gray)]",
        )}
      >
        <span
          className={cn(
            "block size-5 rounded-full bg-[var(--color-neutral-white)] shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-[translate] duration-150 ease-out motion-reduce:transition-none",
            on ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0",
          )}
        />
      </span>
      {on ? "On" : "Off"}
    </button>
  );
}

function lastChangedText(item: PlatformSetting): string {
  if (!item.updatedAt) return "Using the default.";
  const when = formatDateTime(item.updatedAt);
  return item.updatedByName
    ? `Last changed ${when} by ${item.updatedByName}`
    : `Last changed ${when}`;
}
