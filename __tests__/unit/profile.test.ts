import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ApiError,
  SECTIONS,
  conflictField,
  emptyForm,
  formFromProfile,
  formatBdPhone,
  normalizeBdPhone,
  profileApi,
  toPayload,
  validate,
} from "@/lib/profile";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { post: vi.fn(), patch: vi.fn() } }));

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
    expect(validate(contact, emptyForm()).phoneNumber).toBe(
      "Enter your phone number.",
    );
  });

  it("makes WhatsApp optional", () => {
    const form = {
      ...emptyForm(),
      phoneNumber: "01811111111",
      emergencyContact: "01911111111",
    };
    expect(validate(contact, form)).toEqual({});
  });

  it("rejects a WhatsApp number that matches the phone number", () => {
    const form = {
      ...emptyForm(),
      phoneNumber: "01811111111",
      whatsappNumber: "+8801811111111",
      emergencyContact: "01911111111",
    };
    expect(validate(contact, form).whatsappNumber).toMatch(
      /same as your phone/,
    );
  });

  it("rejects an emergency contact that matches the phone number", () => {
    const form = {
      ...emptyForm(),
      phoneNumber: "01811111111",
      emergencyContact: "+8801811111111",
    };
    expect(validate(contact, form).emergencyContact).toBe(
      "Use a different number from your phone number.",
    );
  });

  it("rejects the same number twice", () => {
    const form = {
      ...emptyForm(),
      phoneNumber: "01811111111",
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

  it("sends phone normalized and WhatsApp as null when empty", () =>
    expect(
      toPayload(
        "STUDENT",
        { ...form, phoneNumber: "01811 111111", whatsappNumber: "" },
        ["phoneNumber", "whatsappNumber"],
      ),
    ).toEqual({ phoneNumber: "+8801811111111", whatsappNumber: null }));

  it("leaves tutor lists out of the profile body", () =>
    expect(
      toPayload("TUTOR", form, ["areaIds", "subjectIds", "parentsInfo"]),
    ).toEqual({ parentsInfo: undefined }));

  it("sends a location with district for a Places address", () => {
    const withPlace = {
      ...form,
      address: " Dhanmondi, Dhaka ",
      placeId: "ChIJ123",
      latitude: 23.7465,
      longitude: 90.376,
      district: "Dhaka",
    };
    expect(toPayload("STUDENT", withPlace, ["address"])).toEqual({
      address: "Dhanmondi, Dhaka",
      location: {
        lat: 23.7465,
        lng: 90.376,
        addressText: "Dhanmondi, Dhaka",
        district: "Dhaka",
        placeId: "ChIJ123",
      },
    });
  });

  it.each([
    ["no place", { placeId: "" }],
    ["no district", { district: null }],
    ["no coordinates", { latitude: null }],
  ])("omits location when there is %s", (_, patch) => {
    const partial = {
      ...form,
      address: "Dhanmondi, Dhaka",
      placeId: "ChIJ123",
      latitude: 23.7465,
      longitude: 90.376,
      district: "Dhaka",
      ...patch,
    };
    const body = toPayload("STUDENT", partial, ["address"]);
    expect(body).toEqual({ address: "Dhanmondi, Dhaka" });
    expect(body).not.toHaveProperty("placeId");
    expect(body).not.toHaveProperty("latitude");
  });
});

describe("formFromProfile", () => {
  const base = {
    id: "p_1",
    name: "Rahim",
    address: "House 12, Road 4",
    emergencyContact: "+8801911111111",
    phoneNumber: "+8801811111111",
    whatsappNumber: "+8801712345678",
    whatsappVerifiedAt: null,
    studentIdNumber: "NDC-1",
    verificationStatus: "NOT_SUBMITTED" as const,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    areaId: 1,
  };

  it("reads place, coordinates and district from location", () => {
    const form = formFromProfile({
      ...base,
      location: {
        lat: 23.7465,
        lng: 90.376,
        addressText: "House 12, Road 4",
        districtCode: "dhaka",
        placeId: "ChIJ123",
        needsReaddress: false,
      },
    });
    expect(form).toMatchObject({
      placeId: "ChIJ123",
      latitude: 23.7465,
      longitude: 90.376,
      district: "dhaka",
    });
  });

  it("falls back to empty values when location is null", () => {
    const form = formFromProfile({ ...base, location: null });
    expect(form).toMatchObject({
      placeId: "",
      latitude: null,
      longitude: null,
      district: null,
    });
  });

  it("reads a null WhatsApp number as empty", () => {
    const form = formFromProfile({
      ...base,
      location: null,
      whatsappNumber: null,
    });
    expect(form).toMatchObject({
      phoneNumber: "+8801811111111",
      whatsappNumber: "",
    });
  });
});

describe("profileApi.save", () => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status });

  beforeEach(() => vi.clearAllMocks());

  it("shows a duplicate phone number and does not patch", async () => {
    vi.mocked(api.post).mockResolvedValue(
      json(409, {
        error: "PhoneInUse",
        message: "This phone number is already in use.",
      }),
    );
    const err = await profileApi.save("STUDENT", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      message: "Phone number is already in use, please use a different one.",
      status: 409,
    });
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("shows a duplicate WhatsApp number and does not patch", async () => {
    vi.mocked(api.post).mockResolvedValue(
      json(409, {
        error: "WhatsappInUse",
        message: "This WhatsApp number is already in use.",
      }),
    );
    const err = await profileApi.save("TUTOR", {}).catch((e) => e);
    expect(err).toMatchObject({
      message: "WhatsApp number is already in use, please use a different one.",
    });
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("patches when the profile already exists", async () => {
    vi.mocked(api.post).mockResolvedValue(
      json(409, { error: "Error", message: "Student profile already exists" }),
    );
    vi.mocked(api.patch).mockResolvedValue(json(200, { id: "p_1" }));
    await expect(
      profileApi.save("STUDENT", { name: "Rahim" }),
    ).resolves.toEqual({ id: "p_1" });
    expect(api.patch).toHaveBeenCalledWith("/api/v1/students/me", {
      name: "Rahim",
    });
  });
});

describe("conflictField", () => {
  it.each([
    [
      "Phone number is already in use, please use a different one.",
      "phoneNumber",
    ],
    [
      "WhatsApp number is already in use, please use a different one.",
      "whatsappNumber",
    ],
  ])("maps %s to %s", (message, field) =>
    expect(conflictField(new ApiError(message, 409))).toBe(field),
  );

  it("ignores other errors", () =>
    expect(
      conflictField(new ApiError("Request failed (409).", 409)),
    ).toBeNull());
});
