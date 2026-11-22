import { queryOptions } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import {
  emptyEducation,
  type Curriculum,
  type EducationFields,
} from "./education";
import { TUITION_TYPES } from "./profile";
import { queryKeys } from "./query-keys";
import { daysPerWeekError, EVERY_DAY } from "./days";

export type TuitionType = (typeof TUITION_TYPES)[number];

export type ListingStatus = "DRAFT" | "OPEN" | "FILLED" | "CLOSED" | "EXPIRED";
export type TutorGenderPref = "ANY" | "MALE" | "FEMALE";
export type Tone = "success" | "warning" | "error" | "neutral" | "info";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type Requirement = Schemas["Requirement"];
export type CreateRequirementBody = Schemas["CreateRequirementInput"];
export type UpdateRequirementBody = Schemas["UpdateRequirementInput"];

export type RequirementForm = EducationFields & {
  subjectIds: number[];
  instituteName: string;
  areaId: number | null;
  tuitionType: TuitionType;
  daysPerWeek: number;
  availableDays: number;
  timeOfDay: string;
  hireByDate: string;
  salary: string;
  studentCount: number;
  tutorGenderPref: TutorGenderPref;
};

export type RequirementFormErrors = Partial<
  Record<keyof RequirementForm, string>
>;

const DAY_MS = 24 * 60 * 60 * 1000;

const DHAKA_DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Dhaka",
});

/** Calendar date (YYYY-MM-DD) in Asia/Dhaka, the zone the product runs in. */
export function dhakaIsoDate(date: Date): string {
  return DHAKA_DATE.format(date);
}

const POSTED_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/** "12 Mar 2026" in Asia/Dhaka. Unparseable input comes back unchanged. */
export function formatPostedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : POSTED_DATE.format(date);
}

export function getLocalIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(timeOfDay: string | null): string {
  if (!timeOfDay) return "";
  const [h, m] = timeOfDay.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeOfDay;
  const date = new Date(Date.UTC(1970, 0, 1, h, m));
  return new Intl.DateTimeFormat("en-BD", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatTaka(amount: number | null): string {
  if (amount === null || amount === undefined) return "";
  const formatted = new Intl.NumberFormat("en-BD").format(amount);
  return `৳${formatted}`;
}

// Takes the generated string status; unknown values fall through to the default label.
export function statusMeta(status: ListingStatus | string): {
  tone: Tone;
  label: string;
} {
  switch (status) {
    case "OPEN":
      return { tone: "success", label: "Open" };
    case "DRAFT":
      return { tone: "neutral", label: "Draft" };
    case "FILLED":
      return { tone: "info", label: "Tutor hired" };
    case "CLOSED":
      return { tone: "neutral", label: "Closed" };
    case "EXPIRED":
      return { tone: "warning", label: "Expired" };
    default:
      return { tone: "neutral", label: status };
  }
}

// A new requirement starts on Bangla Medium; a saved one keeps whatever it has (null on old drafts).
export const DEFAULT_CURRICULUM: Curriculum = "BANGLA_MEDIUM";

export function emptyRequirementForm(
  defaultAreaId?: number,
  now = new Date(),
): RequirementForm {
  return {
    ...emptyEducation,
    curriculum: DEFAULT_CURRICULUM,
    // Fresh array so the shared emptyEducation object is never mutated.
    admissionTargets: [],
    subjectIds: [],
    instituteName: "",
    areaId: defaultAreaId ?? null,
    tuitionType: "Home Tutoring Solo",
    daysPerWeek: 3,
    availableDays: EVERY_DAY,
    timeOfDay: "",
    hireByDate: dhakaIsoDate(new Date(now.getTime() + 14 * DAY_MS)),
    salary: "",
    studentCount: 1,
    tutorGenderPref: "ANY",
  };
}

export function fromRequirement(r: Requirement): RequirementForm {
  return {
    subjectIds: r.subjectIds ?? [],
    curriculum: r.curriculum ?? null,
    levelCode: r.levelCode ?? null,
    academicGroup: r.academicGroup ?? null,
    admissionTargets: r.admissionTargets ?? [],
    isRetaker: r.isRetaker ?? false,
    levelNote: r.levelNote ?? "",
    instituteName: r.instituteName ?? "",
    areaId: r.areaId ?? null,
    tuitionType: r.tuitionType ?? "Home Tutoring Solo",
    daysPerWeek: r.daysPerWeek ?? 3,
    availableDays: r.availableDays ?? EVERY_DAY,
    timeOfDay: r.timeOfDay ?? "",
    hireByDate: r.hireByDate ?? "",
    salary: r.salary ? String(r.salary) : "",
    studentCount: r.studentCount ?? 1,
    tutorGenderPref: r.tutorGenderPref ?? "ANY",
  };
}

export function hasAnyInput(form: RequirementForm): boolean {
  return (
    form.subjectIds.length > 0 ||
    (form.curriculum !== null && form.curriculum !== DEFAULT_CURRICULUM) ||
    form.levelCode !== null ||
    form.levelNote.trim().length > 0 ||
    form.instituteName.trim().length > 0 ||
    form.areaId !== null ||
    form.salary.trim().length > 0 ||
    form.timeOfDay.trim().length > 0 ||
    form.availableDays !== EVERY_DAY
  );
}

/**
 * Body for POST /api/v1/requirements (DRAFT or OPEN) and PATCH /api/v1/requirements/{id}.
 * A DRAFT body is partial by design. An OPEN body is only sent after
 * validateRequirementForm passes, which is why the nullable form fields are cast.
 */
export function toPayload(
  form: RequirementForm,
  status?: "DRAFT" | "OPEN",
): UpdateRequirementBody {
  const salaryNum = parseInt(form.salary.replace(/\D/g, ""), 10);
  const levelNote = form.levelNote.trim() || null;

  if (status === "DRAFT") {
    const payload: UpdateRequirementBody = { status: "DRAFT" };
    payload.subjectIds = form.subjectIds;
    if (form.curriculum !== null) payload.curriculum = form.curriculum;
    if (form.levelCode !== null) payload.levelCode = form.levelCode;
    payload.academicGroup = form.academicGroup;
    payload.admissionTargets = form.admissionTargets;
    payload.isRetaker = form.isRetaker;
    payload.levelNote = levelNote;
    if (form.instituteName.trim())
      payload.instituteName = form.instituteName.trim();
    if (form.areaId !== null) payload.areaId = form.areaId;
    if (form.tuitionType) payload.tuitionType = form.tuitionType;
    if (form.daysPerWeek) payload.daysPerWeek = form.daysPerWeek;
    if (form.availableDays) payload.availableDays = form.availableDays;
    if (form.timeOfDay) payload.timeOfDay = form.timeOfDay;
    if (form.hireByDate) payload.hireByDate = form.hireByDate;
    if (!isNaN(salaryNum) && salaryNum > 0) payload.salary = salaryNum;
    if (form.studentCount) payload.studentCount = form.studentCount;
    if (form.tutorGenderPref) payload.tutorGenderPref = form.tutorGenderPref;
    return payload;
  }

  const payload: UpdateRequirementBody = {
    subjectIds: form.subjectIds,
    curriculum: form.curriculum as UpdateRequirementBody["curriculum"],
    levelCode: form.levelCode as number,
    academicGroup: form.academicGroup,
    admissionTargets: form.admissionTargets,
    isRetaker: form.isRetaker,
    levelNote,
    instituteName: form.instituteName.trim() || undefined,
    areaId: form.areaId as number,
    tuitionType: form.tuitionType,
    daysPerWeek: form.daysPerWeek,
    availableDays: form.availableDays,
    timeOfDay: form.timeOfDay,
    hireByDate: form.hireByDate,
    salary: isNaN(salaryNum) ? 0 : salaryNum,
    studentCount: form.studentCount,
    tutorGenderPref: form.tutorGenderPref,
  };

  if (status) {
    payload.status = status;
  }

  return payload;
}

export function validateRequirementForm(
  form: RequirementForm,
  status: "DRAFT" | "OPEN" = "OPEN",
): RequirementFormErrors {
  const errors: RequirementFormErrors = {};

  if (status === "DRAFT") {
    if (!hasAnyInput(form)) {
      errors.subjectIds = "Enter at least one detail to save as a draft.";
    }
    return errors;
  }

  if (form.subjectIds.length === 0) {
    errors.subjectIds = "Choose at least one subject.";
  }
  if (form.curriculum === null) {
    errors.curriculum = "Choose a curriculum.";
  }
  if (form.levelCode === null) {
    errors.levelCode = "Choose a level.";
  }
  if (form.levelNote.trim().length > 40) {
    errors.levelNote = "Keep the note to 40 characters.";
  }
  if (!form.instituteName) {
    errors.instituteName = "Please add the name of your institution.";
  }
  if (form.instituteName && form.instituteName.trim().length > 200) {
    errors.instituteName = "Keep it under 200 characters.";
  }
  if (!form.areaId) {
    errors.areaId = "Choose your area.";
  }
  if (!form.tuitionType) {
    errors.tuitionType = "Choose one.";
  }
  if (form.availableDays === 0) {
    errors.availableDays = "Choose at least one day.";
  }
  if (!form.daysPerWeek || form.daysPerWeek < 1 || form.daysPerWeek > 7) {
    errors.daysPerWeek = "Choose how many days.";
  } else {
    const fit = daysPerWeekError(form.daysPerWeek, form.availableDays);
    if (fit) errors.daysPerWeek = fit;
  }
  if (!form.timeOfDay || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.timeOfDay)) {
    errors.timeOfDay = "Pick a time.";
  }

  const today = getLocalIsoDate();
  if (!form.hireByDate) {
    errors.hireByDate = "Pick a date.";
  } else if (form.hireByDate < today) {
    errors.hireByDate = "Pick today or a later date.";
  }

  const salaryNum = parseInt(form.salary.replace(/\D/g, ""), 10);
  if (!form.salary.trim() || isNaN(salaryNum) || salaryNum <= 0) {
    errors.salary = "Enter a monthly amount in taka.";
  }

  if (!form.studentCount || form.studentCount < 1) {
    errors.studentCount = "Enter a whole number above 0.";
  }

  return errors;
}

/** Past requirements (CLOSED, FILLED, EXPIRED) can be copied into a new post. */
export function isPastRequirement(status: string): boolean {
  return status === "CLOSED" || status === "FILLED" || status === "EXPIRED";
}

export function postAgainHref(id: string): string {
  return `/dashboard/requirements/new?from=${encodeURIComponent(id)}`;
}

export interface RequirementTemplateNotes {
  /** The source's createdAt, shown as "posted on" in the copy notice. */
  postedOn: string;
  /** Subjects on the old post that are no longer offered. */
  removedSubjects: number;
  areaCleared: boolean;
  tuitionTypeReset: boolean;
  /** The source is old enough that its class may have changed. */
  checkClass: boolean;
}

const CHECK_CLASS_AFTER_DAYS = 180;

/**
 * Form state for "Post again": the source's details with anything that may no longer apply
 * cleared, plus notes saying what changed. The hire date is reset to 14 days from now.
 */
export function requirementTemplate(
  source: Requirement,
  opts: { subjectIds: number[]; areaIds: number[]; now?: Date },
): { form: RequirementForm; notes: RequirementTemplateNotes } {
  const now = opts.now ?? new Date();
  const copied = fromRequirement(source);

  const activeSubjects = new Set(opts.subjectIds);
  const subjectIds = copied.subjectIds.filter((id) => activeSubjects.has(id));
  const removedSubjects = copied.subjectIds.length - subjectIds.length;

  const areaCleared =
    copied.areaId !== null && !opts.areaIds.includes(copied.areaId);

  const tuitionTypeReset = !(TUITION_TYPES as readonly string[]).includes(
    copied.tuitionType,
  );

  const fresh = emptyRequirementForm(undefined, now);
  const ageMs = now.getTime() - new Date(source.createdAt).getTime();

  const form: RequirementForm = {
    ...copied,
    subjectIds,
    areaId: areaCleared ? null : copied.areaId,
    tuitionType: tuitionTypeReset ? fresh.tuitionType : copied.tuitionType,
    hireByDate: fresh.hireByDate,
  };

  return {
    form,
    notes: {
      postedOn: source.createdAt,
      removedSubjects,
      areaCleared,
      tuitionTypeReset,
      checkClass: ageMs > CHECK_CLASS_AFTER_DAYS * DAY_MS,
    },
  };
}

export const requirementApi = {
  mine: async () =>
    (await unwrap(client.GET("/api/v1/requirements/mine"))).requirements,

  get: (id: string) =>
    unwrap(
      client.GET("/api/v1/requirements/{id}", { params: { path: { id } } }),
    ),

  create: (body: CreateRequirementBody) =>
    unwrap(client.POST("/api/v1/requirements", { body })),

  update: (id: string, body: UpdateRequirementBody) =>
    unwrap(
      client.PATCH("/api/v1/requirements/{id}", {
        params: { path: { id } },
        body,
      }),
    ),

  close: (id: string) =>
    unwrap(
      client.POST("/api/v1/requirements/{id}/close", {
        params: { path: { id } },
      }),
    ),
};

/** A requirement by id, as the post-again copy and other detail views read it. */
export const requirementQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.requirements.detail(id),
    queryFn: () => requirementApi.get(id),
  });
