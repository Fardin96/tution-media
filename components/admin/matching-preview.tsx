"use client";

import { Section } from "@/components/admin/admin-ui";
import {
  ruleLabel,
  type MatchingPreview,
  type MatchingPreviewPair,
} from "@/lib/admin-matching";

const COUNT = new Intl.NumberFormat("en-BD");

/**
 * Counts under the saved rules and under the draft. `stale` means the draft changed after the
 * preview ran, so the numbers belong to an earlier draft.
 */
export function PreviewPanel({
  pair,
  stale,
}: {
  pair: MatchingPreviewPair;
  stale: boolean;
}) {
  const rows: { label: string; now: string; draft: string }[] = [
    counted(
      "Open tuitions",
      pair.current,
      pair.draft,
      (p) => p.openRequirements,
    ),
    counted(
      "With no tutor",
      pair.current,
      pair.draft,
      (p) => p.requirementsWithNoTutor,
    ),
    counted(
      "With 1–2 tutors",
      pair.current,
      pair.draft,
      (p) => p.requirementsWithFewTutors,
    ),
    counted(
      "With 3 or more",
      pair.current,
      pair.draft,
      (p) => p.requirementsWithManyTutors,
    ),
    {
      label: "Tutors with a match (of listed)",
      now: `${COUNT.format(pair.current.tutorsWithAMatch)} of ${COUNT.format(pair.current.listedTutors)}`,
      draft: `${COUNT.format(pair.draft.tutorsWithAMatch)} of ${COUNT.format(pair.draft.listedTutors)}`,
    },
  ];

  return (
    <Section title="Preview">
      <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
        Counts open tuitions and listed tutors. Nothing is saved.
      </p>
      {stale && (
        <p
          role="status"
          className="text-sm font-medium text-[var(--color-semantic-warning-text)]"
        >
          This preview is for an earlier draft. Preview again to update it.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-80 text-sm">
          <thead>
            <tr className="text-xs text-[var(--color-text-secondary)]">
              <th scope="col" className="pb-2 text-start font-medium" />
              <th scope="col" className="pb-2 text-end font-medium">
                Now
              </th>
              <th scope="col" className="pb-2 text-end font-medium">
                With your changes
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-t border-[var(--color-neutral-border)]"
              >
                <th
                  scope="row"
                  className="py-2.5 pe-4 text-start font-medium text-[var(--color-neutral-charcoal)]"
                >
                  {row.label}
                </th>
                <td className="py-2.5 text-end tabular-nums">{row.now}</td>
                <td className="py-2.5 text-end font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                  {row.draft}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          What keeps tuitions empty
        </h3>
        {pair.draft.blockers.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No rule keeps a tuition empty.
          </p>
        ) : (
          <ul className="grid gap-2">
            {pair.draft.blockers.map((blocker) => (
              <li
                key={blocker.rule}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-[var(--color-neutral-charcoal)]">
                  {ruleLabel(blocker.rule)}
                </span>
                <span className="text-[var(--color-text-secondary)] tabular-nums">
                  {blocker.requirements === 1
                    ? "1 tuition"
                    : `${COUNT.format(blocker.requirements)} tuitions`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function counted(
  label: string,
  current: MatchingPreview,
  draft: MatchingPreview,
  pick: (p: MatchingPreview) => number,
) {
  return {
    label,
    now: COUNT.format(pick(current)),
    draft: COUNT.format(pick(draft)),
  };
}
