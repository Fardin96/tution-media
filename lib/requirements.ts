import { api } from "./api";
import { CLASS_LEVELS, parseJson } from "./profile";

export type ListingStatus = "DRAFT" | "OPEN" | "FILLED" | "CLOSED" | "EXPIRED";
export type TutorGenderPref = "ANY" | "MALE" | "FEMALE";
export type Tone = "success" | "warning" | "error" | "neutral" | "info";

export interface Requirement {
  id: string;
  studentId: string;
  categoryId: number | null;
  areaId: number | null;
  subjectId: number | null;
  classLevel: number | null;
  timeOfDay: string | null;
  daysPerWeek: number | null;
  salary: number | null;
  studentCount: number | null;
  hireByDate: string | null;
  tutorGenderPref: TutorGenderPref;
  instituteName: string | null;
  tuitionType: string | null;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementForm {
  subjectIds: number[];
  classLevel: number | null;
  categoryId: number | null;
  instituteName: string;
  areaId: number | null;
  tuitionType: string;
  daysPerWeek: number;
  timeOfDay: string;
  hireByDate: string;
  salary: string;
  studentCount: number;
  tutorGenderPref: TutorGenderPref;
}

export type RequirementFormErrors = Partial<
  Record<keyof RequirementForm, string>
>;

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

export function classLabel(level: number | null): string {
  if (!level) return "All Classes";
  return CLASS_LEVELS.find((c) => c.value === level)?.label ?? `Class ${level}`;
}

export function statusMeta(status: ListingStatus): {
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

export function emptyRequirementForm(defaultAreaId?: number): RequirementForm {
  const in14Days = new Date();
  in14Days.setDate(in14Days.getDate() + 14);

  return {
    subjectIds: [],
    classLevel: null,
    categoryId: null,
    instituteName: "",
    areaId: defaultAreaId ?? null,
    tuitionType: "Home Tutoring Solo",
    daysPerWeek: 3,
    timeOfDay: "",
    hireByDate: getLocalIsoDate(in14Days),
    salary: "",
    studentCount: 1,
    tutorGenderPref: "ANY",
  };
}

export function fromRequirement(r: Requirement): RequirementForm {
  return {
    subjectIds: r.subjectId ? [r.subjectId] : [],
    classLevel: r.classLevel ?? null,
    categoryId: r.categoryId ?? null,
    instituteName: r.instituteName ?? "",
    areaId: r.areaId ?? null,
    tuitionType: r.tuitionType ?? "Home Tutoring Solo",
    daysPerWeek: r.daysPerWeek ?? 3,
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
    form.classLevel !== null ||
    form.categoryId !== null ||
    form.instituteName.trim().length > 0 ||
    form.areaId !== null ||
    form.salary.trim().length > 0 ||
    form.timeOfDay.trim().length > 0
  );
}

export function toPayload(
  form: RequirementForm,
  status?: "DRAFT" | "OPEN",
): Record<string, unknown> {
  const salaryNum = parseInt(form.salary.replace(/\D/g, ""), 10);

  if (status === "DRAFT") {
    const payload: Record<string, unknown> = { status: "DRAFT" };
    if (form.subjectIds.length > 0) payload.subjectId = form.subjectIds[0];
    if (form.classLevel !== null) payload.classLevel = form.classLevel;
    if (form.categoryId !== null) payload.categoryId = form.categoryId;
    if (form.instituteName.trim())
      payload.instituteName = form.instituteName.trim();
    if (form.areaId !== null) payload.areaId = form.areaId;
    if (form.tuitionType) payload.tuitionType = form.tuitionType;
    if (form.daysPerWeek) payload.daysPerWeek = form.daysPerWeek;
    if (form.timeOfDay) payload.timeOfDay = form.timeOfDay;
    if (form.hireByDate) payload.hireByDate = form.hireByDate;
    if (!isNaN(salaryNum) && salaryNum > 0) payload.salary = salaryNum;
    if (form.studentCount) payload.studentCount = form.studentCount;
    if (form.tutorGenderPref) payload.tutorGenderPref = form.tutorGenderPref;
    return payload;
  }

  const payload: Record<string, unknown> = {
    subjectId: form.subjectIds[0],
    classLevel: form.classLevel,
    categoryId: form.categoryId,
    instituteName: form.instituteName.trim() || undefined,
    areaId: form.areaId,
    tuitionType: form.tuitionType,
    daysPerWeek: form.daysPerWeek,
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
  if (!form.classLevel) {
    errors.classLevel = "Choose a class.";
  }
  if (!form.categoryId) {
    errors.categoryId = "Choose one.";
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
  if (!form.daysPerWeek || form.daysPerWeek < 1 || form.daysPerWeek > 7) {
    errors.daysPerWeek = "Choose how many days.";
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

export const requirementApi = {
  mine: async () =>
    (
      await parseJson<{ requirements: Requirement[] }>(
        await api.get("/api/v1/requirements/mine"),
      )
    ).requirements,

  get: async (id: string) =>
    parseJson<Requirement>(await api.get(`/api/v1/requirements/${id}`)),

  create: async (body: Record<string, unknown>) =>
    parseJson<Requirement>(await api.post("/api/v1/requirements", body)),

  update: async (id: string, body: Record<string, unknown>) =>
    parseJson<Requirement>(await api.patch(`/api/v1/requirements/${id}`, body)),

  close: async (id: string) =>
    parseJson<Requirement>(await api.post(`/api/v1/requirements/${id}/close`)),
};
