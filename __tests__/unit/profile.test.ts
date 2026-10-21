import { describe, it, expect } from "vitest";
import {
  SECTIONS,
  emptyForm,
  formatBdPhone,
  normalizeBdPhone,
  toPayload,
  validate,
} from "@/lib/profile";

describe("normalizeBdPhone", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["01712-345678", "+8801712345678"],
    ["+880 1712 345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
  ])("%s -> %s", (input, out) => expect(normalizeBdPhone(input)).toBe(out));

  it.each(["123", "01212345678", "0171234567", "+1 555 1234567"])(
    "rejects %s",
    (input) => expect(normalizeBdPhone(input)).toBeNull(),
  );

  it("formats for display", () =>
    expect(formatBdPhone("+8801712345678")).toBe("+880 1712-345678"));
});

describe("validate", () => {
  const contact = SECTIONS.STUDENT[1].fields;

  it("names each missing field", () => {
    const errors = validate(SECTIONS.STUDENT[0].fields, emptyForm());
    expect(errors).toEqual({
      name: "Enter your full name.",
      studentIdNumber: "Enter your student ID number.",
    });
    expect(validate(contact, emptyForm()).whatsappNumber).toBe(
      "Enter your WhatsApp number.",
    );
  });

  it("rejects the same number twice", () => {
    const form = {
      ...emptyForm(),
      whatsappNumber: "01712345678",
      emergencyContact: "+8801712345678",
    };
    expect(validate(contact, form).emergencyContact).toMatch(/different/);
  });

  it("skips optional fields and requires list picks", () => {
    const errors = validate(SECTIONS.TUTOR[2].fields, emptyForm());
    expect(errors).toEqual({
      subjectIds: "Choose at least one.",
      areaIds: "Choose at least one.",
    });
    expect(
      validate(SECTIONS.TUTOR[1].fields, emptyForm()).parentsInfo,
    ).toBeUndefined();
  });
});

describe("toPayload", () => {
  const form = {
    ...emptyForm("Rahim"),
    whatsappNumber: "01712 345678",
    areaIds: [3],
    subjectIds: [1],
    parentsInfo: "  ",
  };

  it("maps a student's area to areaId and normalizes phones", () =>
    expect(
      toPayload("STUDENT", form, ["name", "whatsappNumber", "areaIds"]),
    ).toEqual({
      name: "Rahim",
      whatsappNumber: "+8801712345678",
      areaId: 3,
    }));

  it("leaves tutor lists out of the profile body", () =>
    expect(
      toPayload("TUTOR", form, ["areaIds", "subjectIds", "parentsInfo"]),
    ).toEqual({ parentsInfo: undefined }));
});
