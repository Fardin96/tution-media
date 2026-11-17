import { daysPerWeekError } from "./days";
import type { AcademicGroup, AdmissionTarget, Curriculum } from "./education";
import type {
  CreatePackageInput,
  MyPackage,
  PackageCoverage,
  UpdatePackageInput,
} from "./packages";
import {
  DEFAULT_CURRICULUM,
  formatTaka,
  getLocalIsoDate,
} from "./requirements";
import { newProfileSubjects } from "./tutor-requirements";

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 600;
export const DURATION_MIN = 1;
export const DURATION_MAX = 104;
export const STUDENTS_MIN = 1;
export const STUDENTS_MAX = 50;
export const PRICE_MAX = 5_000_000;

export interface PackageForm {
  title: string;
  description: string;
  coverage: PackageCoverage;
  /** Whole weeks, or null while the field is empty. */
  durationWeeks: number | null;
  /** Digits, may contain commas. "" while the field is empty. */
  price: string;
  subjectIds: number[];
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
  maxStudents: number;
  availableFrom: string;
  teachesOnline: boolean;
  zoneIds: string[];
}

export type PackageFormErrors = Partial<Record<keyof PackageForm, string>>;

export function emptyPackageForm(): PackageForm {
  return {
    title: "",
    description: "",
    coverage: "FULL_CURRICULUM",
    durationWeeks: null,
    price: "",
    subjectIds: [],
    levelMin: null,
    levelMax: null,
    curricula: [DEFAULT_CURRICULUM],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 127,
    daysPerWeek: 3,
    maxStudents: 1,
    availableFrom: getLocalIsoDate(),
    teachesOnline: false,
    zoneIds: [],
  };
}

export function fromMyPackage(pkg: MyPackage): PackageForm {
  return {
    title: pkg.title,
    description: pkg.description,
    coverage: pkg.coverage,
    durationWeeks: pkg.durationWeeks,
    price: String(pkg.price),
    subjectIds: [...pkg.subjectIds],
    levelMin: pkg.levelMin,
    levelMax: pkg.levelMax,
    curricula: [...pkg.curricula],
    academicGroups: [...pkg.academicGroups],
    admissionTargets: [...pkg.admissionTargets],
    timeFrom: pkg.timeFrom,
    timeTo: pkg.timeTo,
    availableDays: pkg.availableDays,
    daysPerWeek: pkg.daysPerWeek,
    maxStudents: pkg.maxStudents,
    availableFrom: pkg.availableFrom,
    teachesOnline: pkg.teachesOnline,
    zoneIds: [...pkg.zoneIds],
  };
}

/** Digits only, or null when the field is empty. */
function priceValue(raw: string): number | null {
  const digits = raw.replace(/,/g, "").trim();
  return digits === "" ? null : Number(digits);
}

/** Null checks only, for use after validatePackageForm has passed. */
function required<T>(value: T | null): T {
  if (value === null) throw new Error("Required package field is empty.");
  return value;
}

function sameMembers<T extends string | number>(a: T[], b: T[]): boolean {
  return (
    [...a].map(String).sort().join("|") === [...b].map(String).sort().join("|")
  );
}

export function validatePackageForm(form: PackageForm): PackageFormErrors {
  const errors: PackageFormErrors = {};

  const title = form.title.trim();
  if (title.length === 0) {
    errors.title = "Give this package a title.";
  } else if (title.length > TITLE_MAX) {
    errors.title = `Keep the title to ${TITLE_MAX} characters.`;
  }

  const description = form.description.trim();
  if (description.length === 0) {
    errors.description = "Describe what the package covers.";
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Keep the description to ${DESCRIPTION_MAX} characters.`;
  }

  const weeks = form.durationWeeks;
  if (
    weeks === null ||
    !Number.isInteger(weeks) ||
    weeks < DURATION_MIN ||
    weeks > DURATION_MAX
  ) {
    errors.durationWeeks = `Enter between ${DURATION_MIN} and ${DURATION_MAX} weeks.`;
  }

  const price = priceValue(form.price);
  if (price === null || !Number.isInteger(price) || price < 1) {
    errors.price = "Enter an amount in taka.";
  } else if (price > PRICE_MAX) {
    errors.price = `Keep the price at or below ${formatTaka(PRICE_MAX)}.`;
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

  if (!form.availableFrom) {
    errors.availableFrom = "Choose a start date.";
  }
  if (form.maxStudents < STUDENTS_MIN || form.maxStudents > STUDENTS_MAX) {
    errors.maxStudents = `Enter between ${STUDENTS_MIN} and ${STUDENTS_MAX} students.`;
  }

  if (!form.teachesOnline && form.zoneIds.length === 0) {
    errors.zoneIds = "Pick a zone or turn on online teaching.";
  }

  return errors;
}

export function toCreatePackagePayload(
  form: PackageForm,
  profileSubjectIds: number[],
): CreatePackageInput {
  const body: CreatePackageInput = {
    title: form.title.trim(),
    description: form.description.trim(),
    coverage: form.coverage,
    durationWeeks: required(form.durationWeeks),
    price: required(priceValue(form.price)),
    subjectIds: form.subjectIds,
    levelMin: required(form.levelMin),
    levelMax: required(form.levelMax),
    curricula: form.curricula,
    academicGroups: form.academicGroups,
    admissionTargets: form.admissionTargets,
    timeFrom: form.timeFrom,
    timeTo: form.timeTo,
    availableDays: form.availableDays,
    daysPerWeek: form.daysPerWeek,
    maxStudents: form.maxStudents,
    availableFrom: form.availableFrom,
    teachesOnline: form.teachesOnline,
    zoneIds: form.zoneIds,
  };

  if (newProfileSubjects(form.subjectIds, profileSubjectIds).length > 0) {
    body.syncProfileSubjects = true;
  }
  return body;
}

/** Sends only the fields that changed. Arrays are compared without regard to order. */
export function toPackagePatch(
  original: MyPackage,
  form: PackageForm,
  profileSubjectIds: number[],
): UpdatePackageInput {
  const patch: UpdatePackageInput = {};

  const title = form.title.trim();
  if (title !== original.title) patch.title = title;

  const description = form.description.trim();
  if (description !== original.description) patch.description = description;

  if (form.coverage !== original.coverage) patch.coverage = form.coverage;

  if (form.durationWeeks !== original.durationWeeks) {
    patch.durationWeeks = required(form.durationWeeks);
  }

  const price = priceValue(form.price);
  if (price !== original.price) patch.price = required(price);

  if (form.levelMin !== original.levelMin) {
    patch.levelMin = required(form.levelMin);
  }
  if (form.levelMax !== original.levelMax) {
    patch.levelMax = required(form.levelMax);
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

  if (!sameMembers(form.subjectIds, original.subjectIds)) {
    patch.subjectIds = form.subjectIds;
    if (newProfileSubjects(form.subjectIds, profileSubjectIds).length > 0) {
      patch.syncProfileSubjects = true;
    }
  }
  if (form.timeFrom !== original.timeFrom) patch.timeFrom = form.timeFrom;
  if (form.timeTo !== original.timeTo) patch.timeTo = form.timeTo;
  if (form.availableDays !== original.availableDays) {
    patch.availableDays = form.availableDays;
  }
  if (form.daysPerWeek !== original.daysPerWeek) {
    patch.daysPerWeek = form.daysPerWeek;
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
  if (!sameMembers(form.zoneIds, original.zoneIds)) {
    patch.zoneIds = form.zoneIds;
  }

  return patch;
}
