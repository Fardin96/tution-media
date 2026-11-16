import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { AcademicGroup, AdmissionTarget, Curriculum } from "./education";
import { parseJson, profileApi, type Option } from "./profile";
import { queryKeys } from "./query-keys";
import {
  DEFAULT_CURRICULUM,
  formatTime,
  getLocalIsoDate,
} from "./requirements";

export const MAX_ACTIVE_SETS = 10;

// bit0 = Saturday, matching the server's availableDays bitmask.
export const DAYS: { bit: number; short: string; label: string }[] = [
  { bit: 1, short: "Sat", label: "Saturday" },
  { bit: 2, short: "Sun", label: "Sunday" },
  { bit: 4, short: "Mon", label: "Monday" },
  { bit: 8, short: "Tue", label: "Tuesday" },
  { bit: 16, short: "Wed", label: "Wednesday" },
  { bit: 32, short: "Thu", label: "Thursday" },
  { bit: 64, short: "Fri", label: "Friday" },
];

export interface TutorRequirement {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  levelMin: number;
  levelMax: number;
  curricula: Curriculum[];
  academicGroups: AcademicGroup[];
  admissionTargets: AdmissionTarget[];
  timeFrom: string;
  timeTo: string;
  availableDays: number;
  minSalary: number | null;
  maxStudents: number;
  availableFrom: string;
  teachesOnline: boolean;
  subjectIds: number[];
  zoneIds: string[];
  mappedPackageCount: number;
}

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

const BASE = "/api/v1/tutors/me/requirements";

export const tutorRequirementApi = {
  list: async (status: SetStatus) =>
    (
      await parseJson<{ requirements: TutorRequirement[] }>(
        await api.get(`${BASE}?status=${status}`),
      )
    ).requirements,

  get: async (id: string) =>
    parseJson<TutorRequirement>(await api.get(`${BASE}/${id}`)),

  create: async (body: Record<string, unknown>) =>
    parseJson<TutorRequirement>(await api.post(BASE, body)),

  update: async (id: string, body: Record<string, unknown>) =>
    parseJson<TutorRequirement>(await api.patch(`${BASE}/${id}`, body)),

  setDefault: async (id: string) =>
    parseJson<TutorRequirement>(await api.post(`${BASE}/${id}/default`)),

  archive: async (id: string) =>
    parseJson<TutorRequirement>(await api.delete(`${BASE}/${id}`)),

  restore: async (id: string) =>
    parseJson<TutorRequirement>(await api.post(`${BASE}/${id}/restore`)),
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

  const salary = form.minSalary.replace(/,/g, "").trim();
  if (salary !== "" && !(/^\d+$/.test(salary) && Number(salary) > 0)) {
    errors.minSalary = "Enter an amount in taka.";
  }
  if (form.maxStudents < 1) {
    errors.maxStudents = "At least 1 student.";
  }

  return errors;
}

export function newProfileSubjects(
  subjectIds: number[],
  profileSubjectIds: number[],
): number[] {
  return subjectIds.filter((id) => !profileSubjectIds.includes(id));
}

export function toCreatePayload(
  form: TutorRequirementForm,
  profileSubjectIds: number[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    levelMin: form.levelMin,
    levelMax: form.levelMax,
    curricula: form.curricula,
    academicGroups: form.academicGroups,
    admissionTargets: form.admissionTargets,
    timeFrom: form.timeFrom,
    timeTo: form.timeTo,
    availableDays: form.availableDays,
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
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const name = form.name.trim();
  if (name !== original.name) patch.name = name;
  if (form.levelMin !== original.levelMin) patch.levelMin = form.levelMin;
  if (form.levelMax !== original.levelMax) patch.levelMax = form.levelMax;
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

export function daysLabel(mask: number): string {
  if (mask === 127) return "Every day";
  if (mask === 0) return "No days";
  return DAYS.filter((d) => (mask & d.bit) !== 0)
    .map((d) => d.short)
    .join(", ");
}

export function formatTimeRange(from: string, to: string): string {
  return `${formatTime(from)} – ${formatTime(to)}`;
}

export function useTutorRequirements(status: SetStatus) {
  return useQuery({
    queryKey: queryKeys.tutor.requirements.list(status),
    queryFn: () => tutorRequirementApi.list(status),
    staleTime: 60_000,
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
