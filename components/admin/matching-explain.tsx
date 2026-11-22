"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, CircleMinus, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  DetailList,
  Field,
  Section,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import {
  MODE_LABEL,
  explainRows,
  isUuid,
  useExplainMatch,
  type ExplainRow,
  type ExplainSet,
} from "@/lib/admin-matching";
import { ApiError } from "@/lib/profile";
import { PendingLabel } from "@/components/ui/pending-label";

type Ids = { requirementId: string; tutorId: string };

export function ExplainTab() {
  const [values, setValues] = useState<Ids>({ requirementId: "", tutorId: "" });
  const [errors, setErrors] = useState<Partial<Ids>>({});
  const [checked, setChecked] = useState<Ids>();
  const explain = useExplainMatch(
    checked?.requirementId ?? "",
    checked?.tutorId ?? "",
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (explain.isFetching) return;
    const next: Partial<Ids> = {
      requirementId: isUuid(values.requirementId)
        ? undefined
        : "Enter a valid tuition ID.",
      tutorId: isUuid(values.tutorId) ? undefined : "Enter a valid tutor ID.",
    };
    setErrors(next);
    if (next.requirementId || next.tutorId) return;
    const ids = {
      requirementId: values.requirementId.trim(),
      tutorId: values.tutorId.trim(),
    };
    // The same pair keeps the same query key, so a re-check refetches it explicitly.
    if (
      checked &&
      checked.requirementId === ids.requirementId &&
      checked.tutorId === ids.tutorId
    ) {
      void explain.refetch();
      return;
    }
    setChecked(ids);
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="Check one tuition and one tutor">
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          See every set the tutor has against the tuition, and each rule&apos;s
          result. Works for unlisted tutors too.
        </p>
        <form
          noValidate
          onSubmit={onSubmit}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Tuition ID" error={errors.requirementId}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                value={values.requirementId}
                onChange={(e) => {
                  setValues((v) => ({ ...v, requirementId: e.target.value }));
                  setErrors((x) => ({ ...x, requirementId: undefined }));
                }}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(inputClass, "font-mono text-sm")}
              />
            )}
          </Field>
          <Field label="Tutor ID" error={errors.tutorId}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                value={values.tutorId}
                onChange={(e) => {
                  setValues((v) => ({ ...v, tutorId: e.target.value }));
                  setErrors((x) => ({ ...x, tutorId: undefined }));
                }}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(inputClass, "font-mono text-sm")}
              />
            )}
          </Field>
          <div className="sm:col-span-2 sm:flex sm:justify-end">
            <button
              type="submit"
              disabled={explain.isFetching}
              aria-busy={explain.isFetching || undefined}
              className={cn(primaryButton, "min-h-11 w-full sm:w-auto")}
            >
              <PendingLabel pending={explain.isFetching}>Check</PendingLabel>
            </button>
          </div>
        </form>
      </Section>

      {checked && <ExplainResult query={explain} />}
    </div>
  );
}

function ExplainResult({
  query,
}: {
  query: ReturnType<typeof useExplainMatch>;
}) {
  if (query.isPending) {
    return (
      <div
        role="status"
        className={cn(
          card,
          "h-32 animate-pulse p-5 motion-reduce:animate-none",
        )}
      >
        <span className="sr-only">Checking the pair</span>
      </div>
    );
  }

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <p
          role="alert"
          className={cn(
            card,
            "p-5 text-sm text-[var(--color-semantic-error-text)]",
          )}
        >
          No tuition or tutor with that ID.
        </p>
      );
    }
    return (
      <div
        className={cn(
          card,
          "flex flex-wrap items-center justify-between gap-3 p-5",
        )}
      >
        <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t check this pair.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-busy={query.isFetching || undefined}
          className={cn(secondaryButton, "min-h-11")}
        >
          <PendingLabel pending={query.isFetching}>Try again</PendingLabel>
        </button>
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-[var(--color-neutral-charcoal)]">
          {data.tutor.name}
          {!data.tutor.isListed && (
            <StatusPill tone="warning">Not listed</StatusPill>
          )}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          Matching version {data.version}
        </p>
      </div>

      {data.sets.length === 0 && (
        <p
          className={cn(card, "p-5 text-sm text-[var(--color-text-secondary)]")}
        >
          This tutor has no sets.
        </p>
      )}

      {data.sets.map((set) => (
        <SetResult key={set.setId} set={set} />
      ))}
    </div>
  );
}

function SetResult({ set }: { set: ExplainSet }) {
  const distance =
    set.inZone || set.distanceKm === null
      ? null
      : `${set.distanceKm.toFixed(1)} km away`;

  return (
    <Section
      title={set.name}
      actions={
        set.isDefault ? <StatusPill tone="info">Default</StatusPill> : undefined
      }
    >
      <DetailList
        items={[
          { label: "Score", value: String(set.parts.score) },
          {
            label: "City",
            value: set.studentCity ?? "Outside every city",
          },
          {
            label: "Zone",
            value: set.inZone ? "Inside a zone" : (distance ?? "Not in a zone"),
          },
          {
            label: "Subjects",
            value: `${set.sharedSubjects} of ${set.totalSubjects} shared`,
          },
        ]}
      />

      <ul className="grid gap-2">
        {explainRows(set.parts).map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-[var(--color-surface-subtle)] px-4 py-3"
          >
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-[var(--color-neutral-charcoal)]">
                {row.label}
              </span>
              {row.mode && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {MODE_LABEL[row.mode]}
                </span>
              )}
            </span>
            <RuleResultText row={row} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

const RESULT_ICON = {
  pass: CircleCheck,
  fail: CircleX,
  off: CircleMinus,
} as const;

const RESULT_TONE = {
  pass: "text-[var(--color-semantic-success-text)]",
  fail: "text-[var(--color-semantic-error-text)]",
  off: "text-[var(--color-text-secondary)]",
} as const;

/** Pass, Fail or Off, with an icon, and the rule's share of the score when it has one. */
function RuleResultText({ row }: { row: ExplainRow }) {
  const Icon = RESULT_ICON[row.state];
  const word =
    row.state === "pass" ? "Pass" : row.state === "fail" ? "Fail" : "Off";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums",
        RESULT_TONE[row.state],
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {row.percent === null ? word : `${word} · ${row.percent}%`}
    </span>
  );
}
