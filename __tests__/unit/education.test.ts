import { describe, expect, it } from "vitest";
import {
  combinedLevelLabel,
  educationSummary,
  groupsFor,
  levelLabel,
  levelOptionsFor,
  reconcileCoverage,
  reconcileEducation,
  retakerLabel,
  showsTargets,
  type EducationFields,
  type EducationLookup,
} from "@/lib/education";

const SCIENCE_BUSINESS = [
  { code: "SCIENCE" as const, label: "Science" },
  { code: "BUSINESS" as const, label: "Business" },
];

const lookup: EducationLookup = {
  version: 1,
  levelRange: { min: -4, max: 13 },
  groupLevels: { min: 9, max: 12 },
  admissionLevel: 13,
  levelNoteMaxLength: 40,
  curricula: [
    {
      code: "BANGLA_MEDIUM",
      label: "Bangla Medium",
      levels: [
        { code: 0, label: "Class 0" },
        { code: 8, label: "Class 8" },
        { code: 9, label: "Class 9" },
        { code: 10, label: "Class 10 (SSC)" },
        { code: 12, label: "Class 12 (HSC)" },
        { code: 13, label: "Admission prep" },
      ],
      groups: SCIENCE_BUSINESS,
    },
    {
      code: "MADRASAH",
      label: "Madrasah",
      levels: [
        { code: 0, label: "Dakhil 0" },
        { code: 10, label: "Dakhil 10" },
      ],
      groups: [{ code: "MUJABBID" as const, label: "Mujabbid" }],
    },
    {
      code: "EM_IB",
      label: "IB",
      levels: [{ code: 10, label: "Grade 10 (IB)" }],
      groups: SCIENCE_BUSINESS,
    },
    {
      code: "EM_CAMBRIDGE",
      label: "Cambridge",
      levels: [
        { code: 10, label: "Grade 10 (IGCSE)" },
        { code: 9, label: "Class 9" },
      ],
      groups: SCIENCE_BUSINESS,
    },
  ],
  admissionTargets: [
    { code: "ENGINEERING", label: "Engineering", covers: "BUET, KUET" },
  ],
  retakerLabels: [
    { level: 10, label: "Retake / improvement" },
    { level: 12, label: "Retake / improvement" },
    { level: 13, label: "Retake" },
  ],
};

const base: EducationFields = {
  curriculum: "BANGLA_MEDIUM",
  levelCode: 10,
  academicGroup: "SCIENCE",
  admissionTargets: ["ENGINEERING"],
  isRetaker: true,
  levelNote: "keep me",
};

describe("levelLabel", () => {
  it("returns the label for a level the curriculum offers", () => {
    expect(levelLabel(lookup, "BANGLA_MEDIUM", 10)).toBe("Class 10 (SSC)");
  });

  it("returns the label for level 0", () => {
    expect(levelLabel(lookup, "MADRASAH", 0)).toBe("Dakhil 0");
  });

  it("is undefined for a level the curriculum does not offer, a null level, a null curriculum, or no lookup", () => {
    expect(levelLabel(lookup, "MADRASAH", 9)).toBeUndefined();
    expect(levelLabel(lookup, "BANGLA_MEDIUM", null)).toBeUndefined();
    expect(levelLabel(lookup, null, 10)).toBeUndefined();
    expect(levelLabel(undefined, "BANGLA_MEDIUM", 10)).toBeUndefined();
  });
});

describe("groupsFor", () => {
  it("returns the curriculum's groups at levels 9 to 12", () => {
    expect(groupsFor(lookup, "BANGLA_MEDIUM", 9)).toEqual(SCIENCE_BUSINESS);
    expect(groupsFor(lookup, "BANGLA_MEDIUM", 12)).toEqual(SCIENCE_BUSINESS);
  });

  it("returns nothing at level 8 (below groupLevels)", () => {
    expect(groupsFor(lookup, "BANGLA_MEDIUM", 8)).toEqual([]);
  });

  it("returns nothing for a null level or no lookup", () => {
    expect(groupsFor(lookup, "BANGLA_MEDIUM", null)).toEqual([]);
    expect(groupsFor(undefined, "BANGLA_MEDIUM", 10)).toEqual([]);
  });
});

describe("retakerLabel and showsTargets", () => {
  it("returns the retaker label for levels 10, 12 and 13 only", () => {
    expect(retakerLabel(lookup, 10)).toBe("Retake / improvement");
    expect(retakerLabel(lookup, 13)).toBe("Retake");
    expect(retakerLabel(lookup, 9)).toBeUndefined();
    expect(retakerLabel(lookup, null)).toBeUndefined();
  });

  it("shows admission targets only at the admission level", () => {
    expect(showsTargets(lookup, 13)).toBe(true);
    expect(showsTargets(lookup, 12)).toBe(false);
    expect(showsTargets(undefined, 13)).toBe(false);
  });
});

describe("reconcileEducation", () => {
  it("returns next unchanged when there is no lookup", () => {
    const next = { ...base, levelCode: 99 };
    expect(reconcileEducation(undefined, next)).toBe(next);
  });

  it("keeps everything when the curriculum and level still fit", () => {
    const fits = { ...base, admissionTargets: [] };
    expect(reconcileEducation(lookup, fits)).toEqual(fits);
  });

  it("clears levelCode when the curriculum has no label for it", () => {
    const result = reconcileEducation(lookup, {
      ...base,
      curriculum: "MADRASAH",
      levelCode: 9,
    });
    expect(result.levelCode).toBeNull();
  });

  it("clears levelCode when the curriculum is cleared", () => {
    const result = reconcileEducation(lookup, { ...base, curriculum: null });
    expect(result.levelCode).toBeNull();
  });

  it("keeps level 0 when the curriculum offers it", () => {
    const result = reconcileEducation(lookup, {
      ...base,
      curriculum: "MADRASAH",
      levelCode: 0,
    });
    expect(result.levelCode).toBe(0);
  });

  it("clears academicGroup when the new level is below groupLevels", () => {
    const result = reconcileEducation(lookup, { ...base, levelCode: 8 });
    expect(result.academicGroup).toBeNull();
  });

  it("clears academicGroup when the new curriculum has no such group", () => {
    const result = reconcileEducation(lookup, {
      ...base,
      curriculum: "MADRASAH",
      academicGroup: "SCIENCE",
    });
    expect(result.academicGroup).toBeNull();
  });

  it("keeps academicGroup when the new curriculum and level offer it", () => {
    const result = reconcileEducation(lookup, {
      ...base,
      curriculum: "EM_IB",
      academicGroup: "BUSINESS",
    });
    expect(result.academicGroup).toBe("BUSINESS");
  });

  it("clears admissionTargets unless the level is the admission level", () => {
    expect(
      reconcileEducation(lookup, { ...base, levelCode: 12 }).admissionTargets,
    ).toEqual([]);
    expect(
      reconcileEducation(lookup, { ...base, levelCode: 13 }).admissionTargets,
    ).toEqual(["ENGINEERING"]);
  });

  it("clears isRetaker when the level has no retaker label", () => {
    expect(
      reconcileEducation(lookup, { ...base, levelCode: 9 }).isRetaker,
    ).toBe(false);
    expect(
      reconcileEducation(lookup, { ...base, levelCode: 10 }).isRetaker,
    ).toBe(true);
  });

  it("always keeps levelNote", () => {
    expect(
      reconcileEducation(lookup, { ...base, curriculum: null }).levelNote,
    ).toBe("keep me");
  });
});

describe("educationSummary", () => {
  it("joins level, group and retaker labels with a middle dot", () => {
    expect(educationSummary(lookup, base)).toBe(
      "Class 10 (SSC) · Science · Retake / improvement",
    );
  });

  it("omits the group and retaker when they are not set", () => {
    expect(
      educationSummary(lookup, {
        ...base,
        academicGroup: null,
        isRetaker: false,
      }),
    ).toBe("Class 10 (SSC)");
  });

  it("returns an empty string without a lookup or a level", () => {
    expect(educationSummary(undefined, base)).toBe("");
    expect(educationSummary(lookup, { ...base, levelCode: null })).toBe("");
  });

  it("formats level 0 instead of treating it as empty", () => {
    expect(
      educationSummary(lookup, {
        curriculum: "MADRASAH",
        levelCode: 0,
        academicGroup: null,
        isRetaker: false,
      }),
    ).toBe("Dakhil 0");
  });

  it("falls back to 'Level N' when the label is missing", () => {
    expect(
      educationSummary(lookup, {
        curriculum: "MADRASAH",
        levelCode: 9,
        academicGroup: null,
        isRetaker: false,
      }),
    ).toBe("Level 9");
  });
});

describe("combinedLevelLabel", () => {
  it("joins each curriculum's label for the level", () => {
    expect(
      combinedLevelLabel(
        lookup,
        ["BANGLA_MEDIUM", "EM_CAMBRIDGE", "EM_IB"],
        10,
      ),
    ).toBe("Class 10 (SSC) · Grade 10 (IGCSE) · Grade 10 (IB)");
  });

  it("skips curricula that have no label for the level", () => {
    expect(combinedLevelLabel(lookup, ["MADRASAH", "BANGLA_MEDIUM"], 9)).toBe(
      "Class 9",
    );
  });

  it("removes duplicate labels", () => {
    expect(
      combinedLevelLabel(lookup, ["BANGLA_MEDIUM", "EM_CAMBRIDGE"], 9),
    ).toBe("Class 9");
  });

  it("returns an empty string with no lookup", () => {
    expect(combinedLevelLabel(undefined, ["BANGLA_MEDIUM"], 10)).toBe("");
  });
});

describe("levelOptionsFor", () => {
  it("returns the union of the curricula's levels, sorted, with combined labels", () => {
    expect(levelOptionsFor(lookup, ["EM_CAMBRIDGE", "BANGLA_MEDIUM"])).toEqual([
      { code: 0, label: "Class 0" },
      { code: 8, label: "Class 8" },
      { code: 9, label: "Class 9" },
      { code: 10, label: "Grade 10 (IGCSE) · Class 10 (SSC)" },
      { code: 12, label: "Class 12 (HSC)" },
      { code: 13, label: "Admission prep" },
    ]);
  });

  it("keeps level 0 and a level only one curriculum offers", () => {
    expect(levelOptionsFor(lookup, ["MADRASAH", "EM_IB"])).toEqual([
      { code: 0, label: "Dakhil 0" },
      { code: 10, label: "Dakhil 10 · Grade 10 (IB)" },
    ]);
  });

  it("returns nothing without a lookup or without curricula", () => {
    expect(levelOptionsFor(undefined, ["BANGLA_MEDIUM"])).toEqual([]);
    expect(levelOptionsFor(lookup, [])).toEqual([]);
  });
});

describe("reconcileCoverage", () => {
  const coverage = {
    levelMin: 9,
    levelMax: 10,
    curricula: ["BANGLA_MEDIUM" as const],
    academicGroups: ["SCIENCE" as const, "MUJABBID" as const],
    admissionTargets: ["ENGINEERING" as const],
  };

  it("returns the same object when there is no lookup", () => {
    expect(reconcileCoverage(undefined, coverage)).toBe(coverage);
  });

  it("keeps only groups offered by a chosen curriculum", () => {
    expect(
      reconcileCoverage(lookup, { ...coverage, curricula: ["MADRASAH"] })
        .academicGroups,
    ).toEqual(["MUJABBID"]);
    expect(
      reconcileCoverage(lookup, {
        ...coverage,
        curricula: ["MADRASAH", "BANGLA_MEDIUM"],
      }).academicGroups,
    ).toEqual(["SCIENCE", "MUJABBID"]);
  });

  it("clears groups when the range does not overlap groupLevels", () => {
    expect(
      reconcileCoverage(lookup, { ...coverage, levelMin: 0, levelMax: 8 })
        .academicGroups,
    ).toEqual([]);
    expect(
      reconcileCoverage(lookup, { ...coverage, levelMin: 13, levelMax: 13 })
        .academicGroups,
    ).toEqual([]);
  });

  it("keeps groups when the range overlaps groupLevels at an edge", () => {
    expect(
      reconcileCoverage(lookup, { ...coverage, levelMin: 4, levelMax: 9 })
        .academicGroups,
    ).toEqual(["SCIENCE"]);
  });

  it("clears groups when a level is null", () => {
    expect(
      reconcileCoverage(lookup, { ...coverage, levelMin: null }).academicGroups,
    ).toEqual([]);
    expect(
      reconcileCoverage(lookup, { ...coverage, levelMax: null }).academicGroups,
    ).toEqual([]);
  });

  it("keeps admission targets only when levelMax is the admission level", () => {
    expect(
      reconcileCoverage(lookup, { ...coverage, levelMin: 12, levelMax: 13 })
        .admissionTargets,
    ).toEqual(["ENGINEERING"]);
    expect(reconcileCoverage(lookup, coverage).admissionTargets).toEqual([]);
    expect(
      reconcileCoverage(lookup, { ...coverage, levelMax: null })
        .admissionTargets,
    ).toEqual([]);
  });

  it("never changes the levels", () => {
    const result = reconcileCoverage(lookup, {
      ...coverage,
      levelMin: -4,
      levelMax: 0,
      curricula: ["MADRASAH"],
    });
    expect(result.levelMin).toBe(-4);
    expect(result.levelMax).toBe(0);
  });
});
