import { describe, it, expect } from "vitest";
import {
  emptyForm,
  formFromProfile,
  SECTIONS,
  toPayload,
  type ProfileForm,
} from "@/lib/profile";
import {
  emptyRequirementForm,
  fromRequirement,
  requirementTemplate,
  toPayload as requirementPayload,
  type Requirement,
} from "@/lib/requirements";
import {
  parseAliases,
  validateAliases,
  validateName,
} from "@/lib/institutions";

const tutorForm = (overrides: Partial<ProfileForm> = {}): ProfileForm => ({
  ...emptyForm("Nusrat"),
  instituteName: "University of Dhaka",
  institutionId: 2,
  ...overrides,
});

describe("toPayload for the institution field", () => {
  const keys = ["instituteName"] as const;

  it("sends the picked id with the name", () => {
    expect(toPayload("TUTOR", tutorForm(), [...keys])).toEqual({
      instituteName: "University of Dhaka",
      institutionId: 2,
    });
  });

  it("sends null when the name was typed", () => {
    expect(
      toPayload(
        "TUTOR",
        tutorForm({
          institutionId: null,
          instituteName: " Holy Cross College ",
        }),
        [...keys],
      ),
    ).toEqual({ instituteName: "Holy Cross College", institutionId: null });
  });

  it("never sends the institution to students", () => {
    expect(toPayload("STUDENT", tutorForm(), [...keys])).toEqual({});
  });

  it("reads the id from a tutor profile, and null for a student", () => {
    const tutor = {
      name: "Nusrat",
      instituteName: "University of Dhaka",
      institutionId: 2,
      address: "House 7",
      phoneNumber: "+8801811111111",
      emergencyContact: null,
      whatsappNumber: null,
      studentIdNumber: "1805123",
      gender: "FEMALE",
      location: null,
      parentsInfo: null,
    } as unknown as Parameters<typeof formFromProfile>[0];
    expect(formFromProfile(tutor).institutionId).toBe(2);
    expect(
      formFromProfile({ ...tutor, institutionId: null }).institutionId,
    ).toBeNull();
  });

  it("uses the same field definition in the identity section", () => {
    const field = SECTIONS.TUTOR[0].fields.find(
      (f) => f.key === "instituteName",
    );
    expect(field).toMatchObject({ kind: "institution", maxLength: 150 });
  });
});

describe("requirement institutionId", () => {
  const base = { ...emptyRequirementForm(3, new Date("2026-11-01T00:00:00Z")) };

  it("starts empty and sends the picked id when posting", () => {
    expect(base.institutionId).toBeNull();
    const form = {
      ...base,
      subjectIds: [1],
      instituteName: "Dhaka College",
      institutionId: 44,
    };
    expect(requirementPayload(form, "DRAFT")).toMatchObject({
      instituteName: "Dhaka College",
      institutionId: 44,
    });
    expect(requirementPayload(form)).toMatchObject({ institutionId: 44 });
  });

  it("sends null to unlink a typed name", () => {
    const form = { ...base, instituteName: "Holy Cross", institutionId: null };
    expect(requirementPayload(form)).toMatchObject({
      institutionId: null,
      instituteName: "Holy Cross",
    });
    expect(requirementPayload(form, "DRAFT")).toMatchObject({
      institutionId: null,
    });
  });

  it("reads the id from a saved requirement and keeps it for Post again", () => {
    const source = {
      id: "req-1",
      status: "CLOSED",
      createdAt: "2026-11-01T00:00:00.000Z",
      instituteName: "Viqarunnisa Noon School",
      institutionId: 9,
      areaId: 1,
      subjectIds: [1],
      curriculum: "BANGLA_MEDIUM",
      levelCode: 1,
      academicGroup: null,
      admissionTargets: [],
      isRetaker: false,
      levelNote: null,
      tuitionType: "Home Tutoring Solo",
      daysPerWeek: 3,
      availableDays: 127,
      timeOfDay: "18:00",
      hireByDate: "2026-12-01",
      salary: 5000,
      studentCount: 1,
      tutorGenderPref: "ANY",
    } as unknown as Requirement;

    expect(fromRequirement(source).institutionId).toBe(9);
    const { form } = requirementTemplate(source, {
      subjectIds: [1],
      areaIds: [1],
    });
    expect(form.institutionId).toBe(9);
  });
});

describe("institution name rules", () => {
  it("validates the school name length", () => {
    expect(validateName(" ")).toBe("Enter a name.");
    expect(validateName("A")).toBe("Use at least 2 characters.");
    expect(validateName("a".repeat(151))).toBe("Use 150 characters or fewer.");
    expect(validateName("Holy Cross")).toBeUndefined();
  });

  it("splits short names on commas and checks the count and length", () => {
    expect(parseAliases(" DU, , Dhaka University ,")).toEqual([
      "DU",
      "Dhaka University",
    ]);
    expect(validateAliases(Array.from({ length: 21 }, (_, i) => `a${i}`))).toBe(
      "Use 20 short names or fewer.",
    );
    expect(validateAliases(["a".repeat(61)])).toBe(
      "Keep each short name to 60 characters or fewer.",
    );
    expect(validateAliases(["DU"])).toBeUndefined();
  });
});

describe("clearing the school on a requirement", () => {
  it("sends null for the name and the link on OPEN and DRAFT", () => {
    const form = {
      ...emptyRequirementForm(3, new Date("2026-11-01T00:00:00Z")),
      subjectIds: [1],
      instituteName: "   ",
      institutionId: null,
    };
    expect(requirementPayload(form, "DRAFT")).toMatchObject({
      instituteName: null,
      institutionId: null,
    });
    expect(requirementPayload(form)).toMatchObject({
      instituteName: null,
      institutionId: null,
    });
  });
});

describe("short names", () => {
  it("rejects a one-character short name", () => {
    expect(validateAliases(["D"])).toBe(
      "Use at least 2 characters for each short name.",
    );
    expect(validateAliases(["DU"])).toBeUndefined();
  });
});
