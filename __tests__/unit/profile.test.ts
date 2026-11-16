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
import { apiFetch } from "@/lib/api";
import type { Schemas } from "@/lib/api-client";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Method and path of the nth request the client sent through apiFetch. */
function sent(i: number) {
  const [url, init] = vi.mocked(apiFetch).mock.calls[i];
  return {
    method: init?.method,
    path: new URL(String(url)).pathname,
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

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

  // it("rejects a WhatsApp number that matches the phone number", () => {
  //   const form = {
  //     ...emptyForm(),
  //     phoneNumber: "01811111111",
  //     whatsappNumber: "+8801811111111",
  //     emergencyContact: "01911111111",
  //   };
  //   expect(validate(contact, form).whatsappNumber).toMatch(
  //     /same as your phone/,
  //   );
  // });

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

  // it("rejects the same number twice", () => {
  //   const form = {
  //     ...emptyForm(),
  //     phoneNumber: "01811111111",
  //     whatsappNumber: "01712345678",
  //     emergencyContact: "+8801712345678",
  //   };
  //   expect(validate(contact, form).emergencyContact).toMatch(/different/);
  // });

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

const studentProfile = {
  id: "p_1",
  accountId: "6f1c2a4e-0b7d-4c1a-9a31-2d5e8f7b9c01",
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
  location: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  areaId: 1,
} satisfies Schemas["StudentProfile"];

describe("formFromProfile", () => {
  const base = studentProfile;

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
  beforeEach(() => vi.clearAllMocks());

  it("shows a duplicate phone number and does not patch", async () => {
    vi.mocked(apiFetch).mockImplementation(async () =>
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
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
    expect(sent(0)).toMatchObject({
      method: "POST",
      path: "/api/v1/students/me",
    });
  });

  it("shows a duplicate WhatsApp number and does not patch", async () => {
    vi.mocked(apiFetch).mockImplementation(async () =>
      json(409, {
        error: "WhatsappInUse",
        message: "This WhatsApp number is already in use.",
      }),
    );
    const err = await profileApi.save("TUTOR", {}).catch((e) => e);
    expect(err).toMatchObject({
      message: "WhatsApp number is already in use, please use a different one.",
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
    expect(sent(0)).toMatchObject({
      method: "POST",
      path: "/api/v1/tutors/me",
    });
  });

  it("patches when the profile already exists", async () => {
    vi.mocked(apiFetch).mockImplementation(async (_url, init) =>
      init?.method === "PATCH"
        ? json(200, studentProfile)
        : json(409, {
            error: "Error",
            message: "Student profile already exists",
          }),
    );
    await expect(
      profileApi.save("STUDENT", { name: "Rahim" }),
    ).resolves.toEqual(studentProfile);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2);
    expect(sent(1)).toEqual({
      method: "PATCH",
      path: "/api/v1/students/me",
      body: { name: "Rahim" },
    });
  });

  it("returns the created profile without patching on success", async () => {
    vi.mocked(apiFetch).mockImplementation(async () =>
      json(201, studentProfile),
    );
    await expect(
      profileApi.save("STUDENT", { name: "Rahim" }),
    ).resolves.toEqual(studentProfile);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
    expect(sent(0)).toMatchObject({ method: "POST" });
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

describe("tutor institute", () => {
  const identity = SECTIONS.TUTOR[0].fields;
  const tutorForm = {
    ...emptyForm("Nusrat"),
    gender: "FEMALE" as const,
    studentIdNumber: "1805123",
    instituteName: "University of Dhaka",
  };

  const tutorProfile = {
    id: "p_2",
    accountId: "6f1c2a4e-0b7d-4c1a-9a31-2d5e8f7b9c02",
    name: "Nusrat Jahan",
    instituteName: "University of Dhaka",
    address: "House 7, Road 2",
    emergencyContact: null,
    phoneNumber: "+8801811111111",
    whatsappNumber: null,
    studentIdNumber: "1805123",
    gender: "FEMALE" as const,
    verificationStatus: "NOT_SUBMITTED" as const,
    isListed: false,
    ratingAvg: 0,
    ratingCount: 0,
    location: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  } satisfies Schemas["Tutor"];

  it("sits right before the university student ID for tutors", () =>
    expect(identity.map((f) => f.key)).toEqual([
      "name",
      "gender",
      "instituteName",
      "studentIdNumber",
    ]));

  it("is not in the student sections", () =>
    expect(
      SECTIONS.STUDENT.flatMap((s) => s.fields.map((f) => f.key)),
    ).not.toContain("instituteName"));

  it("requires an institute for tutors", () => {
    expect(validate(identity, { ...tutorForm, instituteName: "  " })).toEqual({
      instituteName: "Enter your university or college.",
    });
    expect(validate(identity, tutorForm)).toEqual({});
  });

  it("keeps the institute under 120 characters", () =>
    expect(
      validate(identity, { ...tutorForm, instituteName: "a".repeat(121) })
        .instituteName,
    ).toBe("Keep it under 120 characters."));

  it("sends the trimmed institute for tutors", () =>
    expect(
      toPayload(
        "TUTOR",
        { ...tutorForm, instituteName: "  University of Dhaka " },
        ["instituteName"],
      ),
    ).toEqual({ instituteName: "University of Dhaka" }));

  it("never sends the institute for students", () =>
    expect(
      toPayload(
        "STUDENT",
        { ...emptyForm("Rahim"), instituteName: "University of Dhaka" },
        ["name", "instituteName"],
      ),
    ).toEqual({ name: "Rahim" }));

  it("reads the institute from a tutor profile", () =>
    expect(formFromProfile(tutorProfile).instituteName).toBe(
      "University of Dhaka",
    ));

  it("reads a missing institute as empty", () =>
    expect(
      formFromProfile({ ...tutorProfile, instituteName: null }).instituteName,
    ).toBe(""));
});
