import { ApiError } from "./profile";
import type { TutorRequirement } from "./tutor-requirements";

export interface RemovalImpact {
  affected: TutorRequirement[];
  emptied: TutorRequirement[];
  emptiedArchived: TutorRequirement[];
}

export interface BlockedSet {
  id: string;
  name: string;
  isDefault: boolean;
}

export type RemovalPlan =
  | { kind: "none" }
  | { kind: "confirm"; title: string; body: string[] }
  | { kind: "blocked"; title: string; body: string[]; sets: BlockedSet[] };

const BLOCKED_TITLE = "Can't remove this subject yet";
const BLOCKED_FOOTER =
  "Edit the set to add another subject, or archive it first.";

/** Subject ids in `before` that `after` no longer contains. */
export function removedSubjectIds(before: number[], after: number[]): number[] {
  return before.filter((id) => !after.includes(id));
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const UNKNOWN_SET_NAME = "One of your sets";

function blockedBody(sets: BlockedSet[], packageCount = 0): string[] {
  const packageLine =
    packageCount === 0
      ? []
      : [
          packageCount === 1
            ? "1 open package would have no subjects left."
            : `${packageCount} open packages would have no subjects left.`,
        ];
  return [
    ...sets.map((s) =>
      s.name === UNKNOWN_SET_NAME
        ? `${s.name} would have no subjects left.`
        : `'${s.name}' would have no subjects left.`,
    ),
    ...packageLine,
    BLOCKED_FOOTER,
  ];
}

export function describeRemoval(
  impact: RemovalImpact,
  removedIds: number[],
  subjectName: (id: number) => string,
): RemovalPlan {
  if (impact.emptied.length > 0) {
    const sets = impact.emptied.map((s) => ({
      id: s.id,
      name: s.name,
      isDefault: s.isDefault,
    }));
    return {
      kind: "blocked",
      title: BLOCKED_TITLE,
      body: blockedBody(sets),
      sets,
    };
  }

  const touched = [...impact.affected, ...impact.emptiedArchived];
  if (touched.length === 0) return { kind: "none" };

  const removedNames = joinNames(removedIds.map(subjectName));
  const setNames = joinNames(touched.map((s) => `'${s.name}'`));
  const body = [`${removedNames} will also be removed from ${setNames}.`];
  for (const s of impact.emptiedArchived) {
    body.push(
      `'${s.name}' is archived and will have no subjects left. Add one before you restore it.`,
    );
  }

  return { kind: "confirm", title: "Remove from your sets too?", body };
}

/** Maps a server REQUIREMENT_LOSES_LAST_SUBJECT 409 to the blocked dialog shape. Open packages are counted, not named. */
export function blockedFromServerError(
  err: unknown,
  sets: TutorRequirement[],
): Extract<RemovalPlan, { kind: "blocked" }> | null {
  if (
    !(err instanceof ApiError) ||
    err.code !== "REQUIREMENT_LOSES_LAST_SUBJECT"
  ) {
    return null;
  }

  const raw = err.details?.requirementIds;
  const ids = Array.isArray(raw) ? raw.map((id) => String(id)) : [];
  const rawPackages = err.details?.packageIds;
  const packageCount = Array.isArray(rawPackages) ? rawPackages.length : 0;
  const blocked: BlockedSet[] = ids.map((id) => {
    const known = sets.find((s) => s.id === id);
    return known
      ? { id, name: known.name, isDefault: known.isDefault }
      : { id, name: UNKNOWN_SET_NAME, isDefault: false };
  });

  return {
    kind: "blocked",
    title: BLOCKED_TITLE,
    body: blockedBody(blocked, packageCount),
    sets: blocked,
  };
}
