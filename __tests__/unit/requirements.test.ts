import { describe, expect, it } from "vitest";
import {
  emptyRequirementForm,
  formatTaka,
  formatTime,
  getLocalIsoDate,
  hasAnyInput,
  statusMeta,
  toPayload,
  validateRequirementForm,
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
