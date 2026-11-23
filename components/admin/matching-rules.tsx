"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  card,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { FieldError } from "@/components/profile/profile-fields";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  Field,
  QueryState,
  Section,
  inputClass,
} from "@/components/admin/admin-ui";
import {
  IntegerInput,
  ModeControl,
  ToggleSwitch,
} from "@/components/admin/matching-ui";
import { PreviewPanel } from "@/components/admin/matching-preview";
import {
  EQUIVALENT_TOGGLES,
  MODE_LABEL,
  RULE_COPY,
  RULE_ORDER,
  CITY_LIMIT_NOTE,
  changedFields,
  groupBlocked,
  hasGroup,
  inputFrom,
  issueFields,
  otherGroups,
  toggleGroup,
  useMatchingConfig,
  usePreviewMatching,
  useSaveMatchingConfig,
  withRule,
  type EquivalentGroup,
  type MatchingConfigInput,
  type MatchingPreviewPair,
  type MatchingRecord,
  type RuleId,
  type RuleMode,
} from "@/lib/admin-matching";
import { curriculumOf, useEducationLookup } from "@/lib/education";
import { formatDateTime } from "@/lib/admin";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

const CITY_EDGE_KM = [0, 0.5, 1, 1.5, 2];
const OUTSIDE_KM = [0.5, 1, 1.5, 2, 2.5, 3];
const SLACK = [0, 1, 2] as const;
const SLACK_LABEL: Record<(typeof SLACK)[number], string> = {
  0: "0 classes",
  1: "1 class",
  2: "2 classes",
};

/** Field keys whose errors sit next to their control. Anything else shows at the top. */
const SCALAR_KEYS = ["cityEdgeKm", "outsideCityKm", "distanceScoreKm"];

function isPlacedKey(key: string): boolean {
  if (SCALAR_KEYS.includes(key)) return true;
  return /^rules\.[a-zA-Z]+\.(mode|weight|slack|requireAll)$/.test(key);
}

export function RulesTab({
  canEdit,
  readOnlyNote,
}: {
  canEdit: boolean;
  readOnlyNote: boolean;
}) {
  const query = useMatchingConfig();
  const record = query.data;
  return (
    <QueryState
      query={query}
      isEmpty={!record}
      loadingLabel="Loading matching rules"
      errorText="Couldn't load the matching rules."
      emptyText="No matching rules found."
      skeletonCount={3}
    >
      {record && (
        // Keyed on the saved version, so a save (which bumps it) starts the editor from the new rules.
        <RulesEditor
          key={record.config.version}
          record={record}
          canEdit={canEdit}
          readOnlyNote={readOnlyNote}
        />
      )}
    </QueryState>
  );
}

function RulesEditor({
  record,
  canEdit,
  readOnlyNote,
}: {
  record: MatchingRecord;
  canEdit: boolean;
  readOnlyNote: boolean;
}) {
  const saved = useMemo(() => inputFrom(record.config), [record.config]);
  const lookup = useEducationLookup().data;
  const [draft, setDraft] = useState<MatchingConfigInput>(saved);
  // Bumped on discard so the text inputs (which keep typed text) start again from the saved value.
  const [epoch, setEpoch] = useState(0);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string>();
  const [preview, setPreview] = useState<{
    pair: MatchingPreviewPair;
    key: string;
  }>();
  const save = useSaveMatchingConfig();
  const runPreview = usePreviewMatching();

  const changes = changedFields(saved, draft).length;
  const draftKey = JSON.stringify(draft);

  function edit(next: MatchingConfigInput) {
    setDraft(next);
    setIssues({});
    setTopError(undefined);
  }

  function discard() {
    setDraft(saved);
    setEpoch((n) => n + 1);
    setIssues({});
    setTopError(undefined);
  }

  function reject(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 400) {
      const fields = issueFields(err.issues);
      setIssues(fields);
      const unplaced = Object.entries(fields).find(
        ([key]) => !isPlacedKey(key),
      );
      setTopError(
        unplaced?.[1] ??
          (Object.keys(fields).length === 0 ? err.message : undefined),
      );
      return;
    }
    toastError(fallback, err);
  }

  function onSave() {
    if (save.isPending) return;
    setIssues({});
    setTopError(undefined);
    // mutateAsync: a successful save changes the version, which remounts this editor, and
    // per-call callbacks don't run for an unmounted observer.
    void save.mutateAsync(draft).then(
      () => toastSuccess("Matching rules saved."),
      (err: unknown) => reject(err, "Couldn't save the matching rules."),
    );
  }

  function onPreview() {
    if (runPreview.isPending) return;
    setTopError(undefined);
    const key = draftKey;
    void runPreview.mutateAsync(draft).then(
      (pair) => setPreview({ pair, key }),
      (err: unknown) => reject(err, "Couldn't run the preview."),
    );
  }

  const disabled = !canEdit;
  const versionLine = record.updatedAt
    ? `Version ${record.config.version} · Saved by ${record.updatedByName ?? "an admin"} on ${formatDateTime(record.updatedAt)}`
    : "Using the default rules";
  const labelOf = (code: EquivalentGroup[number]) =>
    curriculumOf(lookup, code)?.label ?? code;
  const others = otherGroups(draft.curriculumEquivalents);

  return (
    <>
      <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
        {versionLine}
      </p>

      {readOnlyNote && (
        <p
          className={cn(card, "p-5 text-sm text-[var(--color-text-secondary)]")}
        >
          Only a super admin can change matching rules.
        </p>
      )}

      {topError && (
        <p
          role="alert"
          className="text-sm font-medium text-[var(--color-semantic-error-text)]"
        >
          {topError}
        </p>
      )}

      <div key={epoch} className="flex flex-col gap-4">
        <Section title="Rules">
          <p className="rounded-2xl bg-[var(--color-surface-subtle)] p-4 text-sm text-pretty text-[var(--color-text-secondary)]">
            {CITY_LIMIT_NOTE}
          </p>
          <ul className="grid gap-5">
            {RULE_ORDER.map((id) => (
              <li key={id}>
                <RuleRow
                  id={id}
                  draft={draft}
                  allowed={record.ruleModes[id] ?? []}
                  issues={issues}
                  disabled={disabled}
                  onChange={edit}
                />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Distances">
          <div className="grid gap-4 sm:grid-cols-3">
            <KmSelect
              label="City edge"
              hint="A tutor living outside the student's city still matches within this distance of its edge."
              value={draft.cityEdgeKm}
              options={CITY_EDGE_KM}
              error={issues.cityEdgeKm}
              disabled={disabled}
              onChange={(cityEdgeKm) => edit({ ...draft, cityEdgeKm })}
            />
            <KmSelect
              label="Outside cities"
              hint="A student outside every city matches a tutor in the same district within this distance."
              value={draft.outsideCityKm}
              options={OUTSIDE_KM}
              error={issues.outsideCityKm}
              disabled={disabled}
              onChange={(outsideCityKm) => edit({ ...draft, outsideCityKm })}
            />
            <IntegerInput
              label="Score distance"
              suffix="km"
              min={1}
              max={20}
              hint="The location score falls from 1 to 0 over this distance when the student is outside the set's zones."
              value={draft.distanceScoreKm}
              error={issues.distanceScoreKm}
              disabled={disabled}
              onChange={(distanceScoreKm) =>
                edit({ ...draft, distanceScoreKm })
              }
            />
          </div>
        </Section>

        <Section title="Equivalent curricula">
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            A tutor who teaches one curriculum in a group matches a student in
            any other curriculum in that group.
          </p>
          <div className="grid gap-5">
            {EQUIVALENT_TOGGLES.map((toggle) => {
              const blocked = groupBlocked(
                draft.curriculumEquivalents,
                toggle.group,
              );
              return (
                <ToggleSwitch
                  key={toggle.label}
                  label={toggle.label}
                  description={
                    blocked
                      ? "A curriculum in this pair is already in another group."
                      : undefined
                  }
                  on={hasGroup(draft.curriculumEquivalents, toggle.group)}
                  disabled={disabled || blocked}
                  onChange={(on) =>
                    edit({
                      ...draft,
                      curriculumEquivalents: toggleGroup(
                        draft.curriculumEquivalents,
                        toggle.group,
                        on,
                      ),
                    })
                  }
                />
              );
            })}
          </div>
          {others.length > 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Also saved, and kept on save:{" "}
              {others
                .map((group) => group.map(labelOf).join(" and "))
                .join("; ")}
              .
            </p>
          )}
        </Section>
      </div>

      {preview && (
        <PreviewPanel pair={preview.pair} stale={preview.key !== draftKey} />
      )}

      {canEdit ? (
        changes > 0 && (
          <SaveBar
            changes={changes}
            saving={save.isPending}
            checking={runPreview.isPending}
            onDiscard={discard}
            onPreview={onPreview}
            onSave={onSave}
          />
        )
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onPreview}
            disabled={runPreview.isPending}
            aria-busy={runPreview.isPending || undefined}
            className={cn(secondaryButton, "min-h-11")}
          >
            <PendingLabel pending={runPreview.isPending}>Preview</PendingLabel>
          </button>
        </div>
      )}
    </>
  );
}

function RuleRow({
  id,
  draft,
  allowed,
  issues,
  disabled,
  onChange,
}: {
  id: RuleId;
  draft: MatchingConfigInput;
  allowed: RuleMode[];
  issues: Record<string, string>;
  disabled: boolean;
  onChange: (next: MatchingConfigInput) => void;
}) {
  const copy = RULE_COPY[id];
  const rule = draft.rules[id];
  const error = [
    issues[`rules.${id}.mode`],
    issues[`rules.${id}.weight`],
    issues[`rules.${id}.slack`],
  ].find(Boolean);

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          {copy.name}
        </p>
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          {copy.description}
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <ModeControl
          label={`${copy.name} mode`}
          options={allowed.map((mode) => ({
            value: mode,
            label: MODE_LABEL[mode],
          }))}
          value={rule.mode}
          disabled={disabled}
          onChange={(mode) => onChange(withRule(draft, id, { mode }))}
        />

        {rule.mode !== "OFF" && (
          <div className="w-28">
            <IntegerInput
              label="Weight"
              min={0}
              max={10}
              value={rule.weight}
              disabled={disabled}
              onChange={(weight) => onChange(withRule(draft, id, { weight }))}
            />
          </div>
        )}

        {id === "level" && "slack" in rule && (
          <Field label="Class slack" error={issues["rules.level.slack"]}>
            {({ id: fieldId, describedBy, invalid }) => (
              <select
                id={fieldId}
                value={String(rule.slack)}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    withRule(draft, "level", { slack: Number(e.target.value) }),
                  )
                }
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(inputClass, "min-w-40 disabled:opacity-60")}
              >
                {SLACK.map((n) => (
                  <option key={n} value={String(n)}>
                    {SLACK_LABEL[n]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {id === "subject" && "requireAll" in rule && (
          <div className="min-w-56">
            <ToggleSwitch
              label="Require every subject"
              on={rule.requireAll}
              disabled={disabled}
              onChange={(requireAll) =>
                onChange(withRule(draft, "subject", { requireAll }))
              }
            />
          </div>
        )}

        {id === "curriculum" && (
          <div className="min-w-56">
            <ToggleSwitch
              label="Admission prep ignores curriculum"
              description="Level 13 (admission prep) matches on admission targets and skips the curriculum rule."
              on={draft.admissionIgnoresCurriculum}
              disabled={disabled}
              onChange={(admissionIgnoresCurriculum) =>
                onChange({ ...draft, admissionIgnoresCurriculum })
              }
            />
          </div>
        )}
      </div>

      {error && (
        <div className="basis-full">
          <FieldError message={error} />
        </div>
      )}
    </div>
  );
}

function KmSelect({
  label,
  hint,
  value,
  options,
  error,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  options: number[];
  error?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(inputClass, "tabular-nums disabled:opacity-60")}
        >
          {options.map((km) => (
            <option key={km} value={String(km)}>
              {`${km} km`}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function SaveBar({
  changes,
  saving,
  checking,
  onDiscard,
  onPreview,
  onSave,
}: {
  changes: number;
  saving: boolean;
  checking: boolean;
  onDiscard: () => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div
      data-sticky-actions
      className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[var(--color-neutral-white)] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_-8px_24px_-12px_rgb(0_0_0/0.12)] sm:px-6"
    >
      <p
        aria-live="polite"
        className="text-sm font-semibold text-[var(--color-neutral-charcoal)] tabular-nums"
      >
        {changes === 1 ? "1 unsaved change" : `${changes} unsaved changes`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving || checking}
          className={cn(ghostButton, "min-h-11")}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onPreview}
          disabled={saving || checking}
          aria-busy={checking || undefined}
          className={cn(secondaryButton, "min-h-11")}
        >
          <PendingLabel pending={checking}>Preview</PendingLabel>
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || checking}
          aria-busy={saving || undefined}
          className={cn(primaryButton, "min-h-11")}
        >
          <PendingLabel pending={saving}>Save</PendingLabel>
        </button>
      </div>
    </div>
  );
}
