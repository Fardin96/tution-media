import { useQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type EducationLookup = Schemas["EducationLookup"];
export type Curriculum = EducationLookup["curricula"][number]["code"];
export type AcademicGroup =
  EducationLookup["curricula"][number]["groups"][number]["code"];
export type AdmissionTarget =
  EducationLookup["admissionTargets"][number]["code"];

export interface EducationFields {
  curriculum: Curriculum | null;
  levelCode: number | null;
  academicGroup: AcademicGroup | null;
  admissionTargets: AdmissionTarget[];
  isRetaker: boolean;
  levelNote: string;
}

export const emptyEducation: EducationFields = {
  curriculum: null,
  levelCode: null,
  academicGroup: null,
  admissionTargets: [],
  isRetaker: false,
  levelNote: "",
};

export async function fetchEducationLookup(): Promise<EducationLookup> {
  return unwrap(client.GET("/api/v1/lookups/education"));
}

export const educationLookupQuery = {
  queryKey: queryKeys.lookups.education,
  queryFn: fetchEducationLookup,
  staleTime: 60 * 60 * 1000,
} as const;

export function useEducationLookup() {
  return useQuery(educationLookupQuery);
}

type CurriculumEntry = EducationLookup["curricula"][number];

export function curriculumOf(
  lookup: EducationLookup | undefined,
  curriculum: Curriculum | null,
): CurriculumEntry | undefined {
  if (!lookup || curriculum === null) return undefined;
  return lookup.curricula.find((c) => c.code === curriculum);
}

export function levelLabel(
  lookup: EducationLookup | undefined,
  curriculum: Curriculum | null,
  level: number | null,
): string | undefined {
  if (level === null) return undefined;
  return curriculumOf(lookup, curriculum)?.levels.find((l) => l.code === level)
    ?.label;
}

export function groupsFor(
  lookup: EducationLookup | undefined,
  curriculum: Curriculum | null,
  level: number | null,
): { code: AcademicGroup; label: string }[] {
  if (!lookup || level === null) return [];
  if (level < lookup.groupLevels.min || level > lookup.groupLevels.max) {
    return [];
  }
  return curriculumOf(lookup, curriculum)?.groups ?? [];
}

export function retakerLabel(
  lookup: EducationLookup | undefined,
  level: number | null,
): string | undefined {
  if (!lookup || level === null) return undefined;
  return lookup.retakerLabels.find((r) => r.level === level)?.label;
}

export function showsTargets(
  lookup: EducationLookup | undefined,
  level: number | null,
): boolean {
  return !!lookup && level === lookup.admissionLevel;
}

/** Resets dependent fields after a curriculum or level change. */
export function reconcileEducation(
  lookup: EducationLookup | undefined,
  next: EducationFields,
): EducationFields {
  if (!lookup) return next;

  const levelCode =
    levelLabel(lookup, next.curriculum, next.levelCode) !== undefined
      ? next.levelCode
      : null;
  const groups = groupsFor(lookup, next.curriculum, levelCode);
  const academicGroup =
    next.academicGroup !== null &&
    groups.some((g) => g.code === next.academicGroup)
      ? next.academicGroup
      : null;

  return {
    ...next,
    levelCode,
    academicGroup,
    admissionTargets: showsTargets(lookup, levelCode)
      ? next.admissionTargets
      : [],
    isRetaker:
      retakerLabel(lookup, levelCode) !== undefined ? next.isRetaker : false,
  };
}

/**
 * Accepts requirement responses too: their curriculum and academicGroup are the same enum
 * unions. Lookups match only known codes, so an unknown one falls back.
 */
export function educationSummary(
  lookup: EducationLookup | undefined,
  e: {
    curriculum: Curriculum | null;
    levelCode: number | null;
    academicGroup: AcademicGroup | null;
    isRetaker: boolean;
  },
): string {
  if (!lookup || e.levelCode === null) return "";
  const curriculum = e.curriculum;

  const parts = [
    levelLabel(lookup, curriculum, e.levelCode) ?? `Level ${e.levelCode}`,
  ];
  const group = groupsFor(lookup, curriculum, e.levelCode).find(
    (g) => g.code === e.academicGroup,
  );
  if (group) parts.push(group.label);
  if (e.isRetaker) {
    const retaker = retakerLabel(lookup, e.levelCode);
    if (retaker) parts.push(retaker);
  }
  return parts.join(" · ");
}

/** Level label across several curricula, de-duplicated and joined with " · ". */
export function combinedLevelLabel(
  lookup: EducationLookup | undefined,
  curricula: Curriculum[],
  level: number,
): string {
  const labels: string[] = [];
  for (const c of curricula) {
    const label = levelLabel(lookup, c, level);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.join(" · ");
}

/** Levels offered by any of the chosen curricula, ascending, labelled across them. */
export function levelOptionsFor(
  lookup: EducationLookup | undefined,
  curricula: Curriculum[],
): { code: number; label: string }[] {
  if (!lookup || curricula.length === 0) return [];

  const codes = new Set<number>();
  for (const c of curricula) {
    for (const l of curriculumOf(lookup, c)?.levels ?? []) codes.add(l.code);
  }

  return [...codes]
    .sort((a, b) => a - b)
    .map((code) => ({
      code,
      label: combinedLevelLabel(lookup, curricula, code),
    }));
}

type CoverageFields = {
  levelMin: number | null;
  levelMax: number | null;
  curricula: Curriculum[];
  academicGroups: AcademicGroup[];
  admissionTargets: AdmissionTarget[];
};

/** Mirrors the server rules for groups and admission targets. Never touches the levels. */
export function reconcileCoverage<T extends CoverageFields>(
  lookup: EducationLookup | undefined,
  c: T,
): T {
  if (!lookup) return c;

  const offered = new Set<AcademicGroup>();
  for (const cur of c.curricula) {
    for (const g of curriculumOf(lookup, cur)?.groups ?? []) {
      offered.add(g.code);
    }
  }

  const { levelMin, levelMax } = c;
  const overlapsGroups =
    levelMin !== null &&
    levelMax !== null &&
    levelMin <= lookup.groupLevels.max &&
    levelMax >= lookup.groupLevels.min;

  return {
    ...c,
    academicGroups: overlapsGroups
      ? c.academicGroups.filter((g) => offered.has(g))
      : [],
    admissionTargets:
      levelMax === lookup.admissionLevel ? c.admissionTargets : [],
  };
}
