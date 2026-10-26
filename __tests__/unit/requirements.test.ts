import { describe, expect, it } from "vitest";
import {
  classLabel,
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

  it("returns class labels", () => {
    expect(classLabel(1)).toBe("Class 1");
    expect(classLabel(10)).toBe("Class 10");
    expect(classLabel(11)).toBe("HSC 1st year");
    expect(classLabel(13)).toBe("Admission prep");
    expect(classLabel(99)).toBe("Class 99");
    expect(classLabel(null)).toBe("All Classes");
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
    const form: RequirementForm = {
      subjectIds: [1, 2],
      classLevel: 9,
      categoryId: 2,
      instituteName: "  NDC  ",
      areaId: 3,
      tuitionType: "Home Tutoring Solo",
      daysPerWeek: 3,
      timeOfDay: "18:00",
      hireByDate: "2026-11-15",
      salary: "8,000",
      studentCount: 1,
      tutorGenderPref: "ANY",
    };

    const payload = toPayload(form, "OPEN");
    expect(payload).toEqual({
      subjectId: 1,
      classLevel: 9,
      categoryId: 2,
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
      subjectId: 2,
      tuitionType: "Home Tutoring Solo",
      daysPerWeek: 3,
      hireByDate: partialForm.hireByDate,
      salary: 10000,
      studentCount: 1,
      tutorGenderPref: "ANY",
    });
  });

  it("detects if form has any input entered", () => {
    const empty = emptyRequirementForm();
    expect(hasAnyInput(empty)).toBe(false);

    expect(hasAnyInput({ ...empty, subjectIds: [1] })).toBe(true);
    expect(hasAnyInput({ ...empty, classLevel: 5 })).toBe(true);
    expect(hasAnyInput({ ...empty, categoryId: 2 })).toBe(true);
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
    expect(errors.classLevel).toBe("Choose a class.");
    expect(errors.categoryId).toBe("Choose one.");
    expect(errors.areaId).toBe("Choose your area.");
    expect(errors.timeOfDay).toBe("Pick a time.");
    expect(errors.salary).toBe("Enter a monthly amount in taka.");

    const validForm: RequirementForm = {
      subjectIds: [1, 2],
      classLevel: 5,
      categoryId: 1,
      instituteName: "Scholastica",
      areaId: 2,
      tuitionType: "Online",
      daysPerWeek: 4,
      timeOfDay: "16:00",
      hireByDate: getLocalIsoDate(),
      salary: "10,500",
      studentCount: 2,
      tutorGenderPref: "FEMALE",
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
});
