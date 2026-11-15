import { describe, it, expect } from "vitest";
import {
  blockedFromServerError,
  describeRemoval,
  joinNames,
  removedSubjectIds,
} from "@/lib/subject-removal";
import { ApiError } from "@/lib/profile";
import {
  subjectRemovalImpact,
  type TutorRequirement,
} from "@/lib/tutor-requirements";

function set(
  id: string,
  name: string,
  subjectIds: number[],
  extra: Partial<TutorRequirement> = {},
): TutorRequirement {
  return {
    id,
    name,
    subjectIds,
    isDefault: false,
    isActive: true,
    ...extra,
  } as TutorRequirement;
}

const NAMES: Record<number, string> = {
  1: "Physics",
  2: "Chemistry",
  3: "Maths",
};
const subjectName = (id: number) => NAMES[id] ?? `Subject ${id}`;

describe("removedSubjectIds", () => {
  it("returns ids present before but missing after", () => {
    expect(removedSubjectIds([1, 2, 3], [1, 3])).toEqual([2]);
  });

  it("ignores added ids and returns [] when nothing is removed", () => {
    expect(removedSubjectIds([1], [1, 2])).toEqual([]);
    expect(removedSubjectIds([], [4])).toEqual([]);
  });
});

describe("joinNames", () => {
  it("joins 0, 1, 2 and 3+ names", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("describeRemoval", () => {
  it("returns none when no set is touched", () => {
    const sets = [set("a", "Evening Math", [3])];
    const impact = subjectRemovalImpact(sets, [1]);
    expect(describeRemoval(impact, [1], subjectName)).toEqual({ kind: "none" });
  });

  it("confirms with one affected set", () => {
    const sets = [set("a", "Evening Math", [1, 3]), set("b", "Other", [3])];
    const impact = subjectRemovalImpact(sets, [1]);
    expect(describeRemoval(impact, [1], subjectName)).toEqual({
      kind: "confirm",
      title: "Remove from your sets too?",
      body: ["Physics will also be removed from 'Evening Math'."],
    });
  });

  it("names every affected set in the confirm line", () => {
    const sets = [
      set("a", "Evening Math", [1, 3]),
      set("b", "Weekend Batch", [1, 2]),
    ];
    const impact = subjectRemovalImpact(sets, [1]);
    expect(describeRemoval(impact, [1], subjectName)).toEqual({
      kind: "confirm",
      title: "Remove from your sets too?",
      body: [
        "Physics will also be removed from 'Evening Math' and 'Weekend Batch'.",
      ],
    });
  });

  it("joins several removed subjects in the first line", () => {
    const sets = [set("a", "Evening Math", [1, 2, 3])];
    const impact = subjectRemovalImpact(sets, [1, 2]);
    expect(describeRemoval(impact, [1, 2], subjectName)).toEqual({
      kind: "confirm",
      title: "Remove from your sets too?",
      body: ["Physics and Chemistry will also be removed from 'Evening Math'."],
    });
  });

  it("adds an archived-and-empty line for emptiedArchived sets", () => {
    const sets = [
      set("a", "Evening Math", [1, 3]),
      set("old", "Old batch", [1], { isActive: false }),
    ];
    const impact = subjectRemovalImpact(sets, [1]);
    expect(describeRemoval(impact, [1], subjectName)).toEqual({
      kind: "confirm",
      title: "Remove from your sets too?",
      body: [
        "Physics will also be removed from 'Evening Math' and 'Old batch'.",
        "'Old batch' is archived and will have no subjects left. Add one before you restore it.",
      ],
    });
  });

  it("blocks when an active set would be left empty", () => {
    const sets = [
      set("a", "Evening Math", [1]),
      set("b", "Weekend Batch", [1, 3], { isDefault: true }),
      set("c", "Old batch", [1], { isActive: false }),
    ];
    const impact = subjectRemovalImpact(sets, [1]);
    expect(describeRemoval(impact, [1], subjectName)).toEqual({
      kind: "blocked",
      title: "Can't remove this subject yet",
      body: [
        "'Evening Math' would have no subjects left.",
        "Edit the set to add another subject, or archive it first.",
      ],
      sets: [{ id: "a", name: "Evening Math", isDefault: false }],
    });
  });

  it("lists every emptied set when blocked", () => {
    const sets = [
      set("a", "Evening Math", [1]),
      set("b", "Weekend Batch", [1], { isDefault: true }),
    ];
    const impact = subjectRemovalImpact(sets, [1]);
    const plan = describeRemoval(impact, [1], subjectName);
    expect(plan.kind).toBe("blocked");
    if (plan.kind !== "blocked") return;
    expect(plan.body).toEqual([
      "'Evening Math' would have no subjects left.",
      "'Weekend Batch' would have no subjects left.",
      "Edit the set to add another subject, or archive it first.",
    ]);
    expect(plan.sets.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("blockedFromServerError", () => {
  const sets = [
    set("a", "Evening Math", [1], { isDefault: false }),
    set("b", "Weekend Batch", [1], { isDefault: true }),
  ];

  it("maps requirementIds to set names for a matching 409", () => {
    const err = new ApiError("conflict", 409, {
      code: "REQUIREMENT_LOSES_LAST_SUBJECT",
      details: { requirementIds: ["b", "a"] },
    });
    expect(blockedFromServerError(err, sets)).toEqual({
      kind: "blocked",
      title: "Can't remove this subject yet",
      body: [
        "'Weekend Batch' would have no subjects left.",
        "'Evening Math' would have no subjects left.",
        "Edit the set to add another subject, or archive it first.",
      ],
      sets: [
        { id: "b", name: "Weekend Batch", isDefault: true },
        { id: "a", name: "Evening Math", isDefault: false },
      ],
    });
  });

  it("uses 'One of your sets' for an unknown id", () => {
    const err = new ApiError("conflict", 409, {
      code: "REQUIREMENT_LOSES_LAST_SUBJECT",
      details: { requirementIds: ["zzz"] },
    });
    expect(blockedFromServerError(err, sets)).toEqual({
      kind: "blocked",
      title: "Can't remove this subject yet",
      body: [
        "One of your sets would have no subjects left.",
        "Edit the set to add another subject, or archive it first.",
      ],
      sets: [{ id: "zzz", name: "One of your sets", isDefault: false }],
    });
  });

  it("returns null for other errors", () => {
    const other = new ApiError("nope", 409, { code: "REQUIREMENT_IS_DEFAULT" });
    expect(blockedFromServerError(other, sets)).toBeNull();
    expect(blockedFromServerError(new Error("boom"), sets)).toBeNull();
    expect(blockedFromServerError(undefined, sets)).toBeNull();
  });
});
