import { describe, expect, it } from "vitest";
import {
  emptyRequirementForm,
  formatPostedDate,
  formatTaka,
  formatTime,
  getLocalIsoDate,
  hasAnyInput,
  isPastRequirement,
  postAgainHref,
  requirementTemplate,
  statusMeta,
  toPayload,
  validateRequirementForm,
  type Requirement,
  type RequirementForm,
} from "@/lib/requirements";

const filledForm: RequirementForm = {
  ...emptyRequirementForm(),
  subjectIds: [1, 2],
  curriculum: "BANGLA_MEDIUM",
  levelCode: 9,
  academicGroup: "SCIENCE",
  admissionTargets: [],
  isRetaker: false,
  levelNote: "",
  instituteName: "  NDC  ",
  areaId: 3,
  daysPerWeek: 3,
  timeOfDay: "18:00",
  hireByDate: "2026-11-15",
  salary: "8,000",
  studentCount: 1,
  tutorGenderPref: "ANY",
};

describe("requirements helpers", () => {
  it("formats time correctly", () => {
    expect(formatTime("18:00")).toBe("6:00 PM");
    expect(formatTime("09:30")).toBe("9:30 AM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime(null)).toBe("");
  });

  it("formats taka correctly", () => {
    expect(formatTaka(8000)).toBe("৳8,000");
    expect(formatTaka(12500)).toBe("৳12,500");
    expect(formatTaka(null)).toBe("");
  });

  it("returns status metadata", () => {
    expect(statusMeta("OPEN")).toEqual({ tone: "success", label: "Open" });
    expect(statusMeta("DRAFT")).toEqual({ tone: "neutral", label: "Draft" });
    expect(statusMeta("FILLED")).toEqual({
      tone: "info",
      label: "Tutor hired",
    });
    expect(statusMeta("CLOSED")).toEqual({ tone: "neutral", label: "Closed" });
    expect(statusMeta("EXPIRED")).toEqual({
      tone: "warning",
      label: "Expired",
    });
  });

  it("converts full form to payload correctly for OPEN status", () => {
    const payload = toPayload(filledForm, "OPEN");
    expect(payload).toEqual({
      subjectIds: [1, 2],
      curriculum: "BANGLA_MEDIUM",
      levelCode: 9,
      academicGroup: "SCIENCE",
      admissionTargets: [],
      isRetaker: false,
      levelNote: null,
      instituteName: "NDC",
      areaId: 3,
      tuitionType: "Home Tutoring Solo",
      daysPerWeek: 3,
      availableDays: 127,
      timeOfDay: "18:00",
      hireByDate: "2026-11-15",
      salary: 8000,
      studentCount: 1,
      tutorGenderPref: "ANY",
      status: "OPEN",
    });
  });

  it("converts partial form to payload correctly for DRAFT status", () => {
    const partialForm: RequirementForm = {
      ...emptyRequirementForm(),
      subjectIds: [2],
      salary: "10,000",
    };

    const payload = toPayload(partialForm, "DRAFT");
    expect(payload).toEqual({
      status: "DRAFT",
      subjectIds: [2],
      curriculum: "BANGLA_MEDIUM",
      academicGroup: null,
      admissionTargets: [],
      isRetaker: false,
      levelNote: null,
      tuitionType: "Home Tutoring Solo",
      daysPerWeek: 3,
      availableDays: 127,
      hireByDate: partialForm.hireByDate,
      salary: 10000,
      studentCount: 1,
      tutorGenderPref: "ANY",
    });
  });

  it("keeps level 0 in the DRAFT payload", () => {
    const payload = toPayload(
      { ...emptyRequirementForm(), curriculum: "MADRASAH", levelCode: 0 },
      "DRAFT",
    );
    expect(payload.levelCode).toBe(0);
    expect(payload.curriculum).toBe("MADRASAH");
  });

  it("sends empty subjectIds on DRAFT so cleared subjects are removed", () => {
    const payload = toPayload(
      {
        ...emptyRequirementForm(),
        subjectIds: [],
        curriculum: "BANGLA_MEDIUM",
        levelCode: 9,
      },
      "DRAFT",
    );
    expect(payload.subjectIds).toEqual([]);
  });

  it("trims levelNote and sends null when it is empty", () => {
    expect(
      toPayload({ ...filledForm, levelNote: "  Board exam  " }, "OPEN")
        .levelNote,
    ).toBe("Board exam");
    expect(
      toPayload({ ...filledForm, levelNote: "   " }, "OPEN").levelNote,
    ).toBe(null);
  });

  it("detects if form has any input entered", () => {
    const empty = emptyRequirementForm();
    expect(hasAnyInput(empty)).toBe(false);

    expect(hasAnyInput({ ...empty, subjectIds: [1] })).toBe(true);
    expect(hasAnyInput({ ...empty, curriculum: "EM_IB" })).toBe(true);
    // The default curriculum alone is not input.
    expect(empty.curriculum).toBe("BANGLA_MEDIUM");
    expect(hasAnyInput({ ...empty, levelCode: 5 })).toBe(true);
    expect(hasAnyInput({ ...empty, levelCode: 0 })).toBe(true);
    expect(hasAnyInput({ ...empty, levelNote: "Retake" })).toBe(true);
    expect(hasAnyInput({ ...empty, levelNote: "   " })).toBe(false);
    expect(hasAnyInput({ ...empty, instituteName: "Scholastica" })).toBe(true);
    expect(hasAnyInput({ ...empty, areaId: 4 })).toBe(true);
    expect(hasAnyInput({ ...empty, salary: "5000" })).toBe(true);
    expect(hasAnyInput({ ...empty, timeOfDay: "10:00" })).toBe(true);
  });

  it("validates requirement form for DRAFT status", () => {
    const empty = emptyRequirementForm();
    const draftErrors = validateRequirementForm(empty, "DRAFT");
    expect(draftErrors.subjectIds).toBe(
      "Enter at least one detail to save as a draft.",
    );

    const partial: RequirementForm = {
      ...empty,
      subjectIds: [3],
    };
    expect(validateRequirementForm(partial, "DRAFT")).toEqual({});
  });

  it("validates requirement form for OPEN status", () => {
    const emptyForm = emptyRequirementForm();
    const errors = validateRequirementForm(emptyForm, "OPEN");

    expect(errors.subjectIds).toBe("Choose at least one subject.");
    // Curriculum starts on the default, so only an explicit clear is an error.
    expect(errors.curriculum).toBeUndefined();
    expect(
      validateRequirementForm({ ...emptyForm, curriculum: null }, "OPEN")
        .curriculum,
    ).toBe("Choose a curriculum.");
    expect(errors.levelCode).toBe("Choose a level.");
    expect(errors.areaId).toBe("Choose your area.");
    expect(errors.timeOfDay).toBe("Pick a time.");
    expect(errors.salary).toBe("Enter a monthly amount in taka.");

    const validForm: RequirementForm = {
      ...filledForm,
      hireByDate: getLocalIsoDate(),
      tutorGenderPref: "FEMALE",
      instituteName: "Scholastica",
      tuitionType: "Online",
      daysPerWeek: 4,
      timeOfDay: "16:00",
      salary: "10,500",
      studentCount: 2,
    };
    expect(validateRequirementForm(validForm, "OPEN")).toEqual({});

    // Reject past hireByDate
    const pastForm: RequirementForm = {
      ...validForm,
      hireByDate: "2020-01-01",
    };
    expect(validateRequirementForm(pastForm, "OPEN").hireByDate).toBe(
      "Pick today or a later date.",
    );

    // Reject long instituteName
    const longInstituteForm: RequirementForm = {
      ...validForm,
      instituteName: "a".repeat(201),
    };
    expect(
      validateRequirementForm(longInstituteForm, "OPEN").instituteName,
    ).toBe("Keep it under 200 characters.");
  });

  it("reports 'Choose a level.' only when levelCode is null", () => {
    const noLevel = validateRequirementForm(
      { ...filledForm, levelCode: null },
      "OPEN",
    );
    expect(noLevel.levelCode).toBe("Choose a level.");

    const levelZero = validateRequirementForm(
      { ...filledForm, levelCode: 0 },
      "OPEN",
    );
    expect(levelZero.levelCode).toBeUndefined();
  });

  it("rejects a levelNote longer than 40 characters after trimming", () => {
    expect(
      validateRequirementForm(
        { ...filledForm, levelNote: "a".repeat(41) },
        "OPEN",
      ).levelNote,
    ).toBe("Keep the note to 40 characters.");
    expect(
      validateRequirementForm(
        { ...filledForm, levelNote: `  ${"a".repeat(40)}  ` },
        "OPEN",
      ).levelNote,
    ).toBeUndefined();
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

// 23:30 UTC on 20 Nov is 05:30 on 21 Nov in Dhaka, so the Dhaka date is one day ahead of UTC.
const NOW = new Date("2026-11-20T23:30:00Z");

const SOURCE: Requirement = {
  id: "req-old",
  studentId: "stu-1",
  areaId: 3,
  subjectIds: [1, 2, 5],
  curriculum: "BANGLA_MEDIUM",
  levelCode: 9,
  academicGroup: "SCIENCE",
  admissionTargets: [],
  isRetaker: false,
  levelNote: "Weekends only",
  timeOfDay: "18:00",
  daysPerWeek: 3,
  availableDays: 127,
  salary: 8000,
  studentCount: 2,
  hireByDate: "2026-10-01",
  tutorGenderPref: "FEMALE",
  instituteName: "Viqarunnisa Noon School",
  tuitionType: "Home Tutoring Group",
  status: "CLOSED",
  createdAt: "2026-10-01T04:00:00Z",
  updatedAt: "2026-06-01T04:00:00Z",
};

const ALL_ACTIVE = { subjectIds: [1, 2, 5, 9], areaIds: [3, 4] };

describe("requirementTemplate", () => {
  it("copies the source details as they are when nothing is stale", () => {
    const { form, notes } = requirementTemplate(SOURCE, {
      ...ALL_ACTIVE,
      now: NOW,
    });

    expect(form).toMatchObject({
      subjectIds: [1, 2, 5],
      curriculum: "BANGLA_MEDIUM",
      levelCode: 9,
      academicGroup: "SCIENCE",
      levelNote: "Weekends only",
      instituteName: "Viqarunnisa Noon School",
      areaId: 3,
      tuitionType: "Home Tutoring Group",
      daysPerWeek: 3,
      availableDays: 127,
      timeOfDay: "18:00",
      salary: "8000",
      studentCount: 2,
      tutorGenderPref: "FEMALE",
    });
    expect(notes).toEqual({
      postedOn: SOURCE.createdAt,
      removedSubjects: 0,
      areaCleared: false,
      tuitionTypeReset: false,
      checkClass: false,
    });
  });

  it("resets the hire date to 14 days after now, in Dhaka time", () => {
    const { form } = requirementTemplate(SOURCE, { ...ALL_ACTIVE, now: NOW });
    expect(form.hireByDate).toBe("2026-12-05");
    expect(emptyRequirementForm(undefined, NOW).hireByDate).toBe("2026-12-05");
  });

  it("drops subjects that are no longer offered and counts them", () => {
    const { form, notes } = requirementTemplate(SOURCE, {
      subjectIds: [2, 9],
      areaIds: [3],
      now: NOW,
    });
    expect(form.subjectIds).toEqual([2]);
    expect(notes.removedSubjects).toBe(2);
  });

  it("clears the area when it is no longer available", () => {
    const { form, notes } = requirementTemplate(SOURCE, {
      subjectIds: [1, 2, 5],
      areaIds: [4],
      now: NOW,
    });
    expect(form.areaId).toBeNull();
    expect(notes.areaCleared).toBe(true);
  });

  it("does not report an area change when the source had no area", () => {
    const { form, notes } = requirementTemplate(
      { ...SOURCE, areaId: null },
      { ...ALL_ACTIVE, now: NOW },
    );
    expect(form.areaId).toBeNull();
    expect(notes.areaCleared).toBe(false);
  });

  it("resets an unknown tuition type to the default", () => {
    const { form, notes } = requirementTemplate(
      {
        ...SOURCE,
        tuitionType: "Rooftop Tutoring" as Requirement["tuitionType"],
      },
      { ...ALL_ACTIVE, now: NOW },
    );
    expect(form.tuitionType).toBe("Home Tutoring Solo");
    expect(notes.tuitionTypeReset).toBe(true);
  });

  it("flags the class to check once the source is older than 180 days", () => {
    const at = (days: number) =>
      new Date(NOW.getTime() - days * DAY_MS).toISOString();

    expect(
      requirementTemplate(
        { ...SOURCE, createdAt: at(181) },
        { ...ALL_ACTIVE, now: NOW },
      ).notes.checkClass,
    ).toBe(true);
    expect(
      requirementTemplate(
        { ...SOURCE, createdAt: at(179) },
        { ...ALL_ACTIVE, now: NOW },
      ).notes.checkClass,
    ).toBe(false);
  });

  it("keeps a null level and curriculum null", () => {
    const { form } = requirementTemplate(
      { ...SOURCE, levelCode: null, curriculum: null, academicGroup: null },
      { ...ALL_ACTIVE, now: NOW },
    );
    expect(form.levelCode).toBeNull();
    expect(form.curriculum).toBeNull();
    expect(form.academicGroup).toBeNull();
  });
});

describe("isPastRequirement", () => {
  it("is true for closed, filled and expired requirements only", () => {
    expect(isPastRequirement("CLOSED")).toBe(true);
    expect(isPastRequirement("FILLED")).toBe(true);
    expect(isPastRequirement("EXPIRED")).toBe(true);
    expect(isPastRequirement("OPEN")).toBe(false);
    expect(isPastRequirement("DRAFT")).toBe(false);
  });
});

describe("postAgainHref", () => {
  it("links to the new form with the source id encoded", () => {
    expect(postAgainHref("req-1")).toBe(
      "/dashboard/requirements/new?from=req-1",
    );
    expect(postAgainHref("a b/c")).toBe(
      "/dashboard/requirements/new?from=a%20b%2Fc",
    );
  });
});

describe("formatPostedDate", () => {
  it("formats the date in Asia/Dhaka", () => {
    expect(formatPostedDate("2026-03-12T04:00:00Z")).toBe("12 Mar 2026");
    // 19:00 UTC on 11 Mar is already 01:00 on 12 Mar in Dhaka.
    expect(formatPostedDate("2026-03-11T19:00:00Z")).toBe("12 Mar 2026");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatPostedDate("not a date")).toBe("not a date");
  });
});
