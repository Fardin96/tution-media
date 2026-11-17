import { describe, expect, it } from "vitest";
import { EVERY_DAY } from "@/lib/days";
import {
  emptyRequirementForm,
  fromRequirement,
  hasAnyInput,
  toPayload,
  validateRequirementForm,
  type Requirement,
  type RequirementForm,
} from "@/lib/requirements";

const readyForm: RequirementForm = {
  ...emptyRequirementForm(1),
  subjectIds: [1],
  curriculum: "BANGLA_MEDIUM",
  levelCode: 9,
  instituteName: "Dhanmondi School",
  areaId: 1,
  daysPerWeek: 2,
  availableDays: 1 | 4,
  timeOfDay: "18:00",
  hireByDate: "2999-01-01",
  salary: "8,000",
};

describe("requirement availableDays", () => {
  it("starts on every day", () => {
    expect(emptyRequirementForm().availableDays).toBe(EVERY_DAY);
  });

  it("reads availableDays from the server and defaults it when absent", () => {
    const base = { daysPerWeek: 3 } as Requirement;
    expect(
      fromRequirement({ ...base, availableDays: 1 | 2 | 4 }).availableDays,
    ).toBe(7);
    expect(
      fromRequirement({
        ...base,
        availableDays: undefined as unknown as number,
      }).availableDays,
    ).toBe(EVERY_DAY);
  });

  it("treats the default every-day mask as no user input", () => {
    const empty = emptyRequirementForm();
    expect(hasAnyInput(empty)).toBe(false);
    expect(hasAnyInput({ ...empty, availableDays: 1 })).toBe(true);
  });

  it("requires at least one day on OPEN", () => {
    const errors = validateRequirementForm(
      { ...readyForm, availableDays: 0 },
      "OPEN",
    );
    expect(errors.availableDays).toBe("Choose at least one day.");
  });

  it("rejects more days a week than the chosen days", () => {
    const errors = validateRequirementForm(
      { ...readyForm, daysPerWeek: 5, availableDays: 1 | 4 },
      "OPEN",
    );
    expect(errors.daysPerWeek).toBe(
      "Pick at least 5 days, or fewer days a week.",
    );
    expect(errors.availableDays).toBeUndefined();
  });

  it("accepts days a week that fit the chosen days", () => {
    expect(
      validateRequirementForm({ ...readyForm, daysPerWeek: 2 }, "OPEN"),
    ).toEqual({});
  });

  it("keeps the 'how many days' message when days per week is out of range", () => {
    const errors = validateRequirementForm(
      { ...readyForm, daysPerWeek: 0, availableDays: 1 },
      "OPEN",
    );
    expect(errors.daysPerWeek).toBe("Choose how many days.");
  });

  it("sends availableDays in the full OPEN payload", () => {
    expect(toPayload(readyForm, "OPEN").availableDays).toBe(5);
  });

  it("sends availableDays in a DRAFT payload when any day is set", () => {
    expect(toPayload(readyForm, "DRAFT").availableDays).toBe(5);
  });

  it("leaves availableDays out of a DRAFT payload when no day is set", () => {
    const payload = toPayload({ ...readyForm, availableDays: 0 }, "DRAFT");
    expect("availableDays" in payload).toBe(false);
  });
});
