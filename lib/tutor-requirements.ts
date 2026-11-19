import { useQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { daysLabel, daysPerWeekError, daysPerWeekLabel } from "./days";
import type { AcademicGroup, AdmissionTarget, Curriculum } from "./education";
import { profileApi, type Option } from "./profile";
import { queryKeys } from "./query-keys";
import {
  DEFAULT_CURRICULUM,
  formatTime,
  getLocalIsoDate,
} from "./requirements";

export const MAX_ACTIVE_SETS = 10;

export { DAYS, daysLabel } from "./days";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type TutorRequirement = Schemas["TutorRequirement"];
export type CreateTutorRequirementBody = Schemas["CreateTutorRequirementInput"];
export type UpdateTutorRequirementBody = Schemas["UpdateTutorRequirementInput"];

export type SetStatus = "active" | "archived" | "all";

export interface TutorRequirementForm {
  name: string;
  levelMin: number | null;
  levelMax: number | null;
  curricula: Curriculum[];
  academicGroups: AcademicGroup[];
  admissionTargets: AdmissionTarget[];
  timeFrom: string;
  timeTo: string;
  availableDays: number;
  /** 1-7, or null for any number of the available days. */
  daysPerWeek: number | null;
  /** Digits, may contain commas. "" means no floor. */
  minSalary: string;
  maxStudents: number;
  availableFrom: string;
  teachesOnline: boolean;
  subjectIds: number[];
  zoneIds: string[];
}

export type TutorRequirementFormErrors = Partial<
  Record<keyof TutorRequirementForm, string>
>;

export const tutorRequirementApi = {
  list: async (status: SetStatus) =>
    (
      await unwrap(
        client.GET("/api/v1/tutors/me/requirements", {
          params: { query: { status } },
        }),
      )
    ).requirements,

  get: (id: string) =>
    unwrap(
      client.GET("/api/v1/tutors/me/requirements/{id}", {
        params: { path: { id } },
      }),
    ),

  create: (body: CreateTutorRequirementBody) =>
    unwrap(client.POST("/api/v1/tutors/me/requirements", { body })),

  update: (id: string, body: UpdateTutorRequirementBody) =>
    unwrap(
      client.PATCH("/api/v1/tutors/me/requirements/{id}", {
        params: { path: { id } },
        body,
      }),
    ),

  setDefault: (id: string) =>
    unwrap(
      client.POST("/api/v1/tutors/me/requirements/{id}/default", {
        params: { path: { id } },
      }),
    ),

  archive: (id: string) =>
    unwrap(
      client.DELETE("/api/v1/tutors/me/requirements/{id}", {
        params: { path: { id } },
      }),
    ),

  restore: (id: string) =>
    unwrap(
      client.POST("/api/v1/tutors/me/requirements/{id}/restore", {
        params: { path: { id } },
      }),
    ),
};

export function emptyTutorRequirementForm(): TutorRequirementForm {
  return {
    name: "",
    levelMin: null,
    levelMax: null,
    curricula: [DEFAULT_CURRICULUM],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 127,
    daysPerWeek: 3,
    minSalary: "",
    maxStudents: 1,
    availableFrom: getLocalIsoDate(),
    teachesOnline: false,
    subjectIds: [],
    zoneIds: [],
  };
}

export function fromTutorRequirement(
  r: TutorRequirement,
): TutorRequirementForm {
  return {
    name: r.name,
    levelMin: r.levelMin,
    levelMax: r.levelMax,
    curricula: [...r.curricula],
    academicGroups: [...r.academicGroups],
    admissionTargets: [...r.admissionTargets],
    timeFrom: r.timeFrom,
    timeTo: r.timeTo,
    availableDays: r.availableDays,
    daysPerWeek: r.daysPerWeek,
    minSalary: r.minSalary === null ? "" : String(r.minSalary),
    maxStudents: r.maxStudents,
    availableFrom: r.availableFrom,
    teachesOnline: r.teachesOnline,
    subjectIds: [...r.subjectIds],
    zoneIds: [...r.zoneIds],
  };
}

/** Digits only, or null when the field is empty. */
function salaryValue(raw: string): number | null {
  const digits = raw.replace(/,/g, "").trim();
  return digits === "" ? null : Number(digits);
}

/** A set needs a zone or online teaching; the apply gate checks the same on the default set. */
export const ZONE_RULE_MESSAGE = "Pick a zone or turn on online teaching.";

export function validateTutorRequirementForm(
  form: TutorRequirementForm,
): TutorRequirementFormErrors {
  const errors: TutorRequirementFormErrors = {};

  const name = form.name.trim();
  if (name.length === 0) {
    errors.name = "Give this set a name.";
  } else if (name.length > 60) {
    errors.name = "Keep it to 60 characters.";
  }

  if (form.subjectIds.length === 0) {
    errors.subjectIds = "Choose at least one subject.";
  }
  if (form.curricula.length === 0) {
    errors.curricula = "Choose at least one curriculum.";
  }

  // Null checks only: level 0 and negative levels are valid.
  if (form.levelMin === null) {
    errors.levelMin = "Choose the lowest class.";
  }
  if (form.levelMax === null) {
    errors.levelMax = "Choose the highest class.";
  } else if (form.levelMin !== null && form.levelMax < form.levelMin) {
    errors.levelMax = "The highest class must be at or above the lowest.";
  }

  if (form.timeTo <= form.timeFrom) {
    errors.timeTo = "End time must be after the start time.";
  }
  if (form.availableDays === 0) {
    errors.availableDays = "Choose at least one day.";
  }
  if (form.daysPerWeek === null) {
    errors.daysPerWeek = "Choose how many days a week.";
  } else {
    const fit = daysPerWeekError(form.daysPerWeek, form.availableDays);
    if (fit) errors.daysPerWeek = fit;
  }

  const salary = form.minSalary.replace(/,/g, "").trim();
  if (salary !== "" && !(/^\d+$/.test(salary) && Number(salary) > 0)) {
    errors.minSalary = "Enter an amount in taka.";
  }
  if (form.maxStudents < 1) {
    errors.maxStudents = "At least 1 student.";
  }
  if (!form.teachesOnline && form.zoneIds.length === 0) {
    errors.zoneIds = ZONE_RULE_MESSAGE;
  }

  return errors;
}

export function newProfileSubjects(
  subjectIds: number[],
  profileSubjectIds: number[],
): number[] {
  return subjectIds.filter((id) => !profileSubjectIds.includes(id));
}

/** Class levels are null only before validateTutorRequirementForm has run. */
function requiredLevel(value: number | null): number {
  if (value === null) throw new Error("Class level is required.");
  return value;
}

export function toCreatePayload(
  form: TutorRequirementForm,
  profileSubjectIds: number[],
): CreateTutorRequirementBody {
  const body: CreateTutorRequirementBody = {
    name: form.name.trim(),
    levelMin: requiredLevel(form.levelMin),
    levelMax: requiredLevel(form.levelMax),
    curricula: form.curricula,
    academicGroups: form.academicGroups,
    admissionTargets: form.admissionTargets,
    timeFrom: form.timeFrom,
    timeTo: form.timeTo,
    availableDays: form.availableDays,
    daysPerWeek: form.daysPerWeek,
    minSalary: salaryValue(form.minSalary),
    maxStudents: form.maxStudents,
    availableFrom: form.availableFrom,
    teachesOnline: form.teachesOnline,
    subjectIds: form.subjectIds,
    zoneIds: form.zoneIds,
  };

  if (newProfileSubjects(form.subjectIds, profileSubjectIds).length > 0) {
    body.syncProfileSubjects = true;
  }
  return body;
}

function sameMembers<T extends string | number>(a: T[], b: T[]): boolean {
  return (
    [...a].map(String).sort().join("|") === [...b].map(String).sort().join("|")
  );
}

/** Sends only the fields that changed. Arrays are compared without regard to order. */
export function toPatch(
  original: TutorRequirement,
  form: TutorRequirementForm,
  profileSubjectIds: number[],
): UpdateTutorRequirementBody {
  const patch: UpdateTutorRequirementBody = {};

  const name = form.name.trim();
  if (name !== original.name) patch.name = name;
  if (form.levelMin !== original.levelMin) {
    patch.levelMin = requiredLevel(form.levelMin);
  }
  if (form.levelMax !== original.levelMax) {
    patch.levelMax = requiredLevel(form.levelMax);
  }
  if (!sameMembers(form.curricula, original.curricula)) {
    patch.curricula = form.curricula;
  }
  if (!sameMembers(form.academicGroups, original.academicGroups)) {
    patch.academicGroups = form.academicGroups;
  }
  if (!sameMembers(form.admissionTargets, original.admissionTargets)) {
    patch.admissionTargets = form.admissionTargets;
  }
  if (form.timeFrom !== original.timeFrom) patch.timeFrom = form.timeFrom;
  if (form.timeTo !== original.timeTo) patch.timeTo = form.timeTo;
  if (form.availableDays !== original.availableDays) {
    patch.availableDays = form.availableDays;
  }
  if (form.daysPerWeek !== original.daysPerWeek) {
    patch.daysPerWeek = form.daysPerWeek;
  }
  if (salaryValue(form.minSalary) !== original.minSalary) {
    patch.minSalary = salaryValue(form.minSalary);
  }
  if (form.maxStudents !== original.maxStudents) {
    patch.maxStudents = form.maxStudents;
  }
  if (form.availableFrom !== original.availableFrom) {
    patch.availableFrom = form.availableFrom;
  }
  if (form.teachesOnline !== original.teachesOnline) {
    patch.teachesOnline = form.teachesOnline;
  }
  if (!sameMembers(form.subjectIds, original.subjectIds)) {
    patch.subjectIds = form.subjectIds;
    if (newProfileSubjects(form.subjectIds, profileSubjectIds).length > 0) {
      patch.syncProfileSubjects = true;
    }
  }
  if (!sameMembers(form.zoneIds, original.zoneIds)) {
    patch.zoneIds = form.zoneIds;
  }

  return patch;
}

export function dashboardVisibleCount(step: 0 | 1, total: number): number {
  return Math.min(step === 0 ? 1 : 3, total);
}

export function subjectRemovalImpact(
  sets: TutorRequirement[],
  removedIds: number[],
): {
  affected: TutorRequirement[];
  emptied: TutorRequirement[];
  emptiedArchived: TutorRequirement[];
} {
  const affected: TutorRequirement[] = [];
  const emptied: TutorRequirement[] = [];
  const emptiedArchived: TutorRequirement[] = [];

  for (const set of sets) {
    if (!set.subjectIds.some((id) => removedIds.includes(id))) continue;

    const remaining = set.subjectIds.filter((id) => !removedIds.includes(id));
    if (remaining.length > 0) affected.push(set);
    else if (set.isActive) emptied.push(set);
    else emptiedArchived.push(set);
  }

  return { affected, emptied, emptiedArchived };
}

/** "2 days a week · Sat, Mon" when a count is set, otherwise just the chosen days. */
export function daysSummary(
  set: Pick<TutorRequirement, "availableDays" | "daysPerWeek">,
): string {
  if (set.daysPerWeek === null) return daysLabel(set.availableDays);
  return `${daysPerWeekLabel(set.daysPerWeek)} · ${daysLabel(set.availableDays)}`;
}

export function formatTimeRange(from: string, to: string): string {
  return `${formatTime(from)} – ${formatTime(to)}`;
}

export function useTutorRequirements(status: SetStatus, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tutor.requirements.list(status),
    queryFn: () => tutorRequirementApi.list(status),
    staleTime: 60_000,
    enabled,
  });
}

export function useTutorRequirement(id: string) {
  return useQuery({
    queryKey: queryKeys.tutor.requirements.detail(id),
    queryFn: () => tutorRequirementApi.get(id),
    staleTime: 60_000,
  });
}

export function useProfileSubjects() {
  return useQuery({
    queryKey: queryKeys.tutor.profileSubjects,
    queryFn: async (): Promise<Option[]> => {
      const me = await profileApi.me();
      if (!me.tutor) return [];
      return (await profileApi.tutorExtras(me.tutor.id)).subjects;
    },
  });
}
