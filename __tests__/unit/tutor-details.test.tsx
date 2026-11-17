import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TutorSetSection } from "@/components/applications/tutor-details";
import type { ApplicationTutorSet } from "@/lib/applications";

const SUBJECT_OPTIONS = [
  "Bangla",
  "English",
  "Mathematics",
  "Higher Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "ICT",
  "Accounting",
  "Finance",
  "Economics",
  "General Science",
  "Religion",
  "Arabic",
].map((name, i) => ({ id: i + 1, name }));

vi.mock("@/lib/subjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subjects")>()),
  useSubjects: () => ({ subjects: SUBJECT_OPTIONS }),
}));

function tutorSet(
  overrides: Partial<ApplicationTutorSet> = {},
): ApplicationTutorSet {
  return {
    matchedBy: "MATCH",
    set: {
      id: "set-1",
      name: "Evening batch",
      isDefault: true,
      levelMin: 9,
      levelMax: 9,
      curricula: ["BANGLA_MEDIUM"],
      academicGroups: [],
      admissionTargets: [],
      subjectIds: [2, 3],
      timeFrom: "16:00",
      timeTo: "18:00",
      availableDays: 5,
      daysPerWeek: 2,
      minSalary: 5000,
      maxStudents: 3,
      teachesOnline: false,
    },
    ...overrides,
  };
}

describe("TutorSetSection", () => {
  it("titles the set as the tutor's teaching set when it matches", () => {
    render(<TutorSetSection tutorSet={tutorSet()} lookup={undefined} />);

    const section = screen.getByRole("region", { name: "Their teaching set" });
    expect(within(section).getByText("Evening batch")).toBeInTheDocument();
    expect(
      within(section).queryByText(/None of this tutor/),
    ).not.toBeInTheDocument();
  });

  it("explains that the set is the tutor's default when nothing matches exactly", () => {
    render(
      <TutorSetSection
        tutorSet={tutorSet({ matchedBy: "DEFAULT" })}
        lookup={undefined}
      />,
    );

    const section = screen.getByRole("region", { name: "Their teaching set" });
    expect(
      within(section).getByText(
        "None of this tutor's sets match your requirement exactly. This is their default set.",
      ),
    ).toBeInTheDocument();
  });

  it("no longer has a package title or copy", () => {
    // Package applications carry no tutor set, so PACKAGE is not a match value.
    render(
      <TutorSetSection
        tutorSet={tutorSet({
          matchedBy: "PACKAGE" as unknown as ApplicationTutorSet["matchedBy"],
        })}
        lookup={undefined}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Their teaching set" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "The set behind this package" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/None of this tutor/)).not.toBeInTheDocument();
  });
});
