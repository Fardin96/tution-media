import { describe, expect, it } from "vitest";
import {
  dashboardVisibleCount,
  daysLabel,
  daysSummary,
  emptyTutorRequirementForm,
  fromTutorRequirement,
  formatTimeRange,
  newProfileSubjects,
  subjectRemovalImpact,
  toCreatePayload,
  toPatch,
  validateTutorRequirementForm,
  type TutorRequirement,
  type TutorRequirementForm,
} from "@/lib/tutor-requirements";

const validForm: TutorRequirementForm = {
  ...emptyTutorRequirementForm(),
  name: "Evening maths",
  levelMin: 9,
  levelMax: 10,
  subjectIds: [3],
};

const original: TutorRequirement = {
  id: "r1",
  name: "Evening maths",
  isDefault: true,
  isActive: true,
  levelMin: 9,
  levelMax: 10,
  curricula: ["BANGLA_MEDIUM", "EM_IB"],
  academicGroups: ["SCIENCE", "BUSINESS"],
  admissionTargets: [],
  timeFrom: "16:00",
  timeTo: "18:00",
  availableDays: 127,
  daysPerWeek: null,
  minSalary: 8000,
  maxStudents: 2,
  availableFrom: "2026-11-01",
  teachesOnline: false,
  subjectIds: [3, 1],
  zoneIds: ["z1"],
  mappedPackageCount: 0,
};

function set(
  id: string,
  subjectIds: number[],
  isActive: boolean,
): TutorRequirement {
  return { ...original, id, subjectIds, isActive, isDefault: false };
}

describe("validateTutorRequirementForm", () => {
  it("accepts a complete form", () => {
    expect(validateTutorRequirementForm(validForm)).toEqual({});
  });

  it("requires a name and caps it at 60 characters after trimming", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, name: "   " }).name,
    ).toBe("Give this set a name.");
    expect(
      validateTutorRequirementForm({ ...validForm, name: "x".repeat(61) }).name,
    ).toBe("Keep it to 60 characters.");
    expect(
      validateTutorRequirementForm({
        ...validForm,
        name: `  ${"x".repeat(60)}  `,
      }).name,
    ).toBeUndefined();
  });

  it("requires a subject", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, subjectIds: [] }).subjectIds,
    ).toBe("Choose at least one subject.");
  });

  it("requires a curriculum", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, curricula: [] }).curricula,
    ).toBe("Choose at least one curriculum.");
  });

  it("requires both levels with null checks, accepting 0 and -4", () => {
    const errors = validateTutorRequirementForm({
      ...validForm,
      levelMin: null,
      levelMax: null,
    });
    expect(errors.levelMin).toBe("Choose the lowest class.");
    expect(errors.levelMax).toBe("Choose the highest class.");

    expect(
      validateTutorRequirementForm({ ...validForm, levelMin: 0, levelMax: 0 }),
    ).toEqual({});
    expect(
      validateTutorRequirementForm({ ...validForm, levelMin: -4, levelMax: 0 }),
    ).toEqual({});
  });

  it("rejects a highest class below the lowest", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, levelMin: 10, levelMax: 9 })
        .levelMax,
    ).toBe("The highest class must be at or above the lowest.");
  });

  it("requires the end time to be after the start time", () => {
    expect(
      validateTutorRequirementForm({
        ...validForm,
        timeFrom: "18:00",
        timeTo: "18:00",
      }).timeTo,
    ).toBe("End time must be after the start time.");
  });

  it("requires at least one day", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, availableDays: 0 })
        .availableDays,
    ).toBe("Choose at least one day.");
  });

  it("requires a days-per-week choice", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, daysPerWeek: null })
        .daysPerWeek,
    ).toBe("Choose how many days a week.");
  });

  it("rejects more days a week than the chosen days cover", () => {
    expect(
      validateTutorRequirementForm({
        ...validForm,
        availableDays: 1 | 4,
        daysPerWeek: 4,
      }).daysPerWeek,
    ).toBe("Pick at least 4 days, or fewer days a week.");
  });

  it("accepts a days-per-week count equal to the chosen days", () => {
    expect(
      validateTutorRequirementForm({
        ...validForm,
        availableDays: 1 | 4,
        daysPerWeek: 2,
      }),
    ).toEqual({});
  });

  it("accepts an empty salary floor or a positive amount with commas", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, minSalary: "" }),
    ).toEqual({});
    expect(
      validateTutorRequirementForm({ ...validForm, minSalary: "12,500" }),
    ).toEqual({});
  });

  it("rejects a salary that is not a positive integer", () => {
    for (const minSalary of ["0", "-5", "12.5", "abc"]) {
      expect(
        validateTutorRequirementForm({ ...validForm, minSalary }).minSalary,
      ).toBe("Enter an amount in taka.");
    }
  });

  it("requires at least one student", () => {
    expect(
      validateTutorRequirementForm({ ...validForm, maxStudents: 0 })
        .maxStudents,
    ).toBe("At least 1 student.");
  });
});

describe("toCreatePayload", () => {
  it("builds the full body with defaults and no sync flag when subjects are on the profile", () => {
    const payload = toCreatePayload(
      { ...validForm, name: "  Evening maths  ", minSalary: "8,000" },
      [3, 1],
    );
    expect(payload).toEqual({
      name: "Evening maths",
      levelMin: 9,
      levelMax: 10,
      curricula: ["BANGLA_MEDIUM"],
      academicGroups: [],
      admissionTargets: [],
      timeFrom: "16:00",
      timeTo: "18:00",
      availableDays: 127,
      daysPerWeek: 3,
      minSalary: 8000,
      maxStudents: 1,
      availableFrom: validForm.availableFrom,
      teachesOnline: false,
      subjectIds: [3],
      zoneIds: [],
    });
    expect("syncProfileSubjects" in payload).toBe(false);
  });

  it("sends the form's daysPerWeek, including null", () => {
    expect(
      toCreatePayload({ ...validForm, daysPerWeek: 5 }, [3]).daysPerWeek,
    ).toBe(5);
    expect(
      toCreatePayload({ ...validForm, daysPerWeek: null }, [3]).daysPerWeek,
    ).toBeNull();
  });

  it("sends the form's zoneIds", () => {
    const payload = toCreatePayload(
      { ...validForm, zoneIds: ["z1", "z2"] },
      [3],
    );
    expect(payload.zoneIds).toEqual(["z1", "z2"]);
  });

  it("sends null for an empty salary and sets the sync flag for new subjects", () => {
    const payload = toCreatePayload(validForm, [1]);
    expect(payload.minSalary).toBeNull();
    expect(payload.syncProfileSubjects).toBe(true);
  });
});

describe("toPatch", () => {
  const form = fromTutorRequirement(original);

  it("returns an empty object when nothing changed", () => {
    expect(toPatch(original, form, [3, 1])).toEqual({});
  });

  it("returns an empty object when an array is only reordered", () => {
    expect(
      toPatch(
        original,
        {
          ...form,
          curricula: ["EM_IB", "BANGLA_MEDIUM"],
          academicGroups: ["BUSINESS", "SCIENCE"],
          subjectIds: [1, 3],
        },
        [3, 1],
      ),
    ).toEqual({});
  });

  it("sends daysPerWeek only when it changed", () => {
    expect(toPatch(original, { ...form, daysPerWeek: 3 }, [3, 1])).toEqual({
      daysPerWeek: 3,
    });
    expect(
      toPatch(
        { ...original, daysPerWeek: 3 },
        { ...form, daysPerWeek: null },
        [3, 1],
      ),
    ).toEqual({ daysPerWeek: null });
    expect(
      toPatch(
        { ...original, daysPerWeek: 3 },
        { ...form, daysPerWeek: 3 },
        [3, 1],
      ),
    ).toEqual({});
  });

  it("returns only the changed name", () => {
    expect(
      toPatch(original, { ...form, name: "Morning maths" }, [3, 1]),
    ).toEqual({ name: "Morning maths" });
  });

  it("sends the full subjectIds array with the sync flag when a new subject is added", () => {
    expect(
      toPatch(original, { ...form, subjectIds: [3, 1, 7] }, [3, 1]),
    ).toEqual({ subjectIds: [3, 1, 7], syncProfileSubjects: true });
  });

  it("omits the sync flag when every changed subject is already on the profile", () => {
    expect(toPatch(original, { ...form, subjectIds: [1] }, [3, 1])).toEqual({
      subjectIds: [1],
    });
  });

  it("treats an empty salary as null against an original of null", () => {
    expect(
      toPatch(
        { ...original, minSalary: null },
        { ...form, minSalary: "" },
        [3, 1],
      ),
    ).toEqual({});
  });

  it("treats an empty salary as a change when the original had a floor", () => {
    expect(toPatch(original, { ...form, minSalary: "" }, [3, 1])).toEqual({
      minSalary: null,
    });
  });

  it("omits zoneIds when zone membership is unchanged", () => {
    expect(
      toPatch(original, { ...form, maxStudents: 5 }, [3, 1]),
    ).not.toHaveProperty("zoneIds");
  });

  it("sends the full zoneIds array when a zone is added", () => {
    expect(
      toPatch(original, { ...form, zoneIds: ["z1", "z2"] }, [3, 1]),
    ).toEqual({ zoneIds: ["z1", "z2"] });
  });

  it("sends the full zoneIds array when a zone is removed", () => {
    expect(toPatch(original, { ...form, zoneIds: [] }, [3, 1])).toEqual({
      zoneIds: [],
    });
  });

  it("treats reordered zoneIds as unchanged", () => {
    const multi = { ...original, zoneIds: ["z1", "z2"] };
    expect(
      toPatch(
        multi,
        { ...fromTutorRequirement(multi), zoneIds: ["z2", "z1"] },
        [3, 1],
      ),
    ).toEqual({});
  });
});

describe("fromTutorRequirement", () => {
  it("copies zoneIds into a new array", () => {
    const form = fromTutorRequirement({ ...original, zoneIds: ["z1", "z2"] });
    expect(form.zoneIds).toEqual(["z1", "z2"]);
    expect(form.zoneIds).not.toBe(original.zoneIds);
  });

  it("starts an empty zone selection for a new form", () => {
    expect(emptyTutorRequirementForm().zoneIds).toEqual([]);
  });
});

describe("newProfileSubjects", () => {
  it("returns the subject ids missing from the profile", () => {
    expect(newProfileSubjects([1, 2, 3], [2])).toEqual([1, 3]);
    expect(newProfileSubjects([2], [2, 4])).toEqual([]);
  });
});

describe("dashboardVisibleCount", () => {
  it("shows one set on step 0 and three on step 1, capped by the total", () => {
    expect(dashboardVisibleCount(0, 5)).toBe(1);
    expect(dashboardVisibleCount(1, 5)).toBe(3);
    expect(dashboardVisibleCount(1, 2)).toBe(2);
    expect(dashboardVisibleCount(0, 0)).toBe(0);
  });
});

describe("subjectRemovalImpact", () => {
  it("sorts sets into affected, emptied and emptiedArchived", () => {
    const keepsOne = set("keep", [1, 2], true);
    const emptiesActive = set("empty", [1], true);
    const emptiesArchived = set("gone", [1], false);
    const archivedKeeps = set("arch", [1, 3], false);
    const unrelated = set("other", [3], true);

    const impact = subjectRemovalImpact(
      [keepsOne, emptiesActive, emptiesArchived, archivedKeeps, unrelated],
      [1],
    );

    expect(impact.affected).toEqual([keepsOne, archivedKeeps]);
    expect(impact.emptied).toEqual([emptiesActive]);
    expect(impact.emptiedArchived).toEqual([emptiesArchived]);
  });
});

describe("daysLabel", () => {
  it("names the day sets", () => {
    expect(daysLabel(127)).toBe("Every day");
    expect(daysLabel(0)).toBe("No days");
    expect(daysLabel(1 | 4)).toBe("Sat, Mon");
  });
});

describe("daysSummary", () => {
  it("leads with the count when one is set", () => {
    expect(daysSummary({ availableDays: 1 | 4, daysPerWeek: 2 })).toBe(
      "2 days a week · Sat, Mon",
    );
    expect(daysSummary({ availableDays: 127, daysPerWeek: 1 })).toBe(
      "1 day a week · Every day",
    );
  });

  it("shows only the chosen days when the count is null", () => {
    expect(daysSummary({ availableDays: 1 | 4, daysPerWeek: null })).toBe(
      "Sat, Mon",
    );
  });
});

describe("formatTimeRange", () => {
  it("joins the formatted times with an en dash", () => {
    expect(formatTimeRange("16:00", "18:00")).toBe("4:00 PM – 6:00 PM");
  });
});
