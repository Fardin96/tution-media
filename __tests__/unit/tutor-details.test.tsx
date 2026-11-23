import { describe, it, expect } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import {
  TutorProfileSection,
  TutorSetSection,
} from "@/components/applications/tutor-details";
import type {
  ApplicationTutorProfile,
  ApplicationTutorSet,
} from "@/lib/applications";

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

function tutorProfile(
  overrides: Partial<ApplicationTutorProfile> = {},
): ApplicationTutorProfile {
  return {
    id: "tutor-profile-7",
    name: "Rafiq Ahmed",
    avatarUrl: null,
    gender: "MALE",
    instituteName: "University of Dhaka",
    ratingAvg: 4.5,
    ratingCount: 12,
    verificationStatus: "APPROVED",
    areas: [{ id: 1, name: "Dhanmondi" }],
    subjects: [{ id: 5, name: "Physics" }],
    credentials: [],
    ...overrides,
  };
}

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

/** Avatars refresh expired photo links through the query client, so each render gets one. */
function render(ui: ReactElement) {
  const client = new QueryClient();
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
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

  it("links to the tutor's full public profile", () => {
    render(<TutorProfileSection profile={tutorProfile()} />);

    expect(
      screen.getByRole("link", { name: "View full profile" }),
    ).toHaveAttribute("href", "/tutors/tutor-profile-7");
  });
});
