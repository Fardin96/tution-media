import { describe, it, expect } from "vitest";
import {
  emptyPackageForm,
  fromMyPackage,
  toCreatePackagePayload,
  toPackagePatch,
  validatePackageForm,
  type PackageForm,
} from "@/lib/package-form";
import { packageMissing, type MyPackage } from "@/lib/packages";

const PACKAGE: MyPackage = {
  id: "pkg-1",
  tutor: {
    id: "tutor-1",
    name: "Rahim",
    avatarUrl: null,
    gender: "MALE",
    ratingAvg: 0,
    ratingCount: 0,
  },
  title: "SSC Math Booster",
  description: "Full syllabus revision with weekly mock tests.",
  coverage: "FULL_CURRICULUM",
  durationWeeks: 12,
  price: 15000,
  subjectIds: [1, 3],
  levelMin: 9,
  levelMax: 10,
  curricula: ["BANGLA_MEDIUM", "ENGLISH_VERSION"],
  academicGroups: ["SCIENCE"],
  admissionTargets: [],
  timeFrom: "16:00",
  timeTo: "18:00",
  availableDays: 127,
  daysPerWeek: 3,
  maxStudents: 5,
  availableFrom: "2026-11-20",
  teachesOnline: false,
  zoneCount: 2,
  status: "OPEN",
  moderationStatus: "APPROVED",
  createdAt: "2026-11-01T00:00:00Z",
  closed: false,
  myApplication: null,
  zoneIds: ["z1", "z2"],
  moderationNote: null,
  updatedAt: "2026-11-01T00:00:00Z",
  pendingRequestCount: 0,
  requestCount: 0,
};

/** A form that passes validation. */
function validForm(overrides: Partial<PackageForm> = {}): PackageForm {
  return {
    ...emptyPackageForm(),
    title: "SSC Math Booster",
    description: "Full syllabus revision.",
    durationWeeks: 12,
    price: "15,000",
    subjectIds: [1],
    levelMin: 1,
    levelMax: 8,
    teachesOnline: true,
    ...overrides,
  };
}

describe("validatePackageForm", () => {
  it("accepts a complete form", () => {
    expect(validatePackageForm(validForm())).toEqual({});
  });

  it("requires a title and a description after trimming", () => {
    const errors = validatePackageForm(
      validForm({ title: "   ", description: "" }),
    );
    expect(errors.title).toBe("Give this package a title.");
    expect(errors.description).toBe("Describe what the package covers.");
  });

  it("keeps the duration between 1 and 104 whole weeks", () => {
    for (const durationWeeks of [null, 0, 105, 2.5]) {
      expect(
        validatePackageForm(validForm({ durationWeeks })).durationWeeks,
      ).toBe("Enter between 1 and 104 weeks.");
    }
    expect(
      validatePackageForm(validForm({ durationWeeks: 104 })).durationWeeks,
    ).toBeUndefined();
  });

  it("reads the price in taka with commas, and caps it at 5,000,000", () => {
    expect(validatePackageForm(validForm({ price: "" })).price).toBe(
      "Enter an amount in taka.",
    );
    expect(validatePackageForm(validForm({ price: "1.5" })).price).toBe(
      "Enter an amount in taka.",
    );
    expect(
      validatePackageForm(validForm({ price: "5,000,000" })).price,
    ).toBeUndefined();
    expect(validatePackageForm(validForm({ price: "5,000,001" })).price).toBe(
      "Keep the price at or below ৳5,000,000.",
    );
  });

  it("needs a zone unless the tutor teaches online", () => {
    expect(
      validatePackageForm(validForm({ teachesOnline: false, zoneIds: [] }))
        .zoneIds,
    ).toBe("Pick a zone or turn on online teaching.");
    expect(
      validatePackageForm(validForm({ teachesOnline: false, zoneIds: ["z1"] }))
        .zoneIds,
    ).toBeUndefined();
  });

  it("checks students between 1 and 50", () => {
    expect(validatePackageForm(validForm({ maxStudents: 0 })).maxStudents).toBe(
      "Enter between 1 and 50 students.",
    );
    expect(
      validatePackageForm(validForm({ maxStudents: 51 })).maxStudents,
    ).toBe("Enter between 1 and 50 students.");
  });

  it("rejects a days-per-week count above the chosen days", () => {
    const errors = validatePackageForm(
      validForm({ availableDays: 1, daysPerWeek: 3 }),
    );
    expect(errors.daysPerWeek).toBeDefined();
  });

  it("treats level 0 as a real class", () => {
    expect(
      validatePackageForm(validForm({ levelMin: 0, levelMax: 0 })).levelMin,
    ).toBeUndefined();
  });
});

describe("toPackagePatch", () => {
  it("sends nothing when the form still matches the package", () => {
    expect(toPackagePatch(PACKAGE, fromMyPackage(PACKAGE), [1, 3])).toEqual({});
  });

  it("sends only the fields that changed", () => {
    const form = {
      ...fromMyPackage(PACKAGE),
      title: "SSC Math Booster Plus",
      price: "16,000",
    };
    expect(toPackagePatch(PACKAGE, form, [1, 3])).toEqual({
      title: "SSC Math Booster Plus",
      price: 16000,
    });
  });

  it("compares arrays without regard to order", () => {
    const form = {
      ...fromMyPackage(PACKAGE),
      subjectIds: [3, 1],
      curricula: [
        "ENGLISH_VERSION",
        "BANGLA_MEDIUM",
      ] as PackageForm["curricula"],
      zoneIds: ["z2", "z1"],
    };
    expect(toPackagePatch(PACKAGE, form, [1, 3])).toEqual({});
  });

  it("sends a changed subject list with syncProfileSubjects only for new subjects", () => {
    const form = { ...fromMyPackage(PACKAGE), subjectIds: [1, 10] };

    expect(toPackagePatch(PACKAGE, form, [1, 3])).toEqual({
      subjectIds: [1, 10],
      syncProfileSubjects: true,
    });
    expect(toPackagePatch(PACKAGE, form, [1, 3, 10])).toEqual({
      subjectIds: [1, 10],
    });
  });

  it("sends a cleared days-per-week count as null", () => {
    const form = { ...fromMyPackage(PACKAGE), daysPerWeek: null };
    expect(toPackagePatch(PACKAGE, form, [1, 3])).toEqual({
      daysPerWeek: null,
    });
  });

  it("sends zone changes", () => {
    const form = { ...fromMyPackage(PACKAGE), zoneIds: ["z1"] };
    expect(toPackagePatch(PACKAGE, form, [1, 3])).toEqual({ zoneIds: ["z1"] });
  });
});

describe("toCreatePackagePayload", () => {
  it("parses the price and trims the text", () => {
    const payload = toCreatePackagePayload(
      validForm({ title: "  SSC Math Booster  ", price: "15,000" }),
      [1],
    );
    expect(payload.title).toBe("SSC Math Booster");
    expect(payload.price).toBe(15000);
    expect(payload).not.toHaveProperty("syncProfileSubjects");
  });

  it("asks the API to sync subjects that are not on the profile", () => {
    const payload = toCreatePackagePayload(
      validForm({ subjectIds: [1, 10] }),
      [1],
    );
    expect(payload).toMatchObject({
      subjectIds: [1, 10],
      syncProfileSubjects: true,
    });
  });
});

describe("packageMissing", () => {
  it("drops the default requirement set, which packages don't need", () => {
    expect(
      packageMissing(["name", "default_requirement", "verification"]),
    ).toEqual(["name", "verification"]);
    expect(packageMissing(["default_requirement"])).toEqual([]);
  });
});
