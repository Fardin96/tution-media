import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TutorRequirementsSection } from "@/components/tutor-requirements/dashboard-section";
import { useEducationLookup } from "@/lib/education";
import {
  useProfileSubjects,
  useTutorRequirements,
  type TutorRequirement,
} from "@/lib/tutor-requirements";

vi.mock("@/lib/education", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/education")>()),
  useEducationLookup: vi.fn(),
}));

vi.mock("@/lib/tutor-requirements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor-requirements")>()),
  useTutorRequirements: vi.fn(),
  useProfileSubjects: vi.fn(),
}));

function set(id: string, name: string, isDefault = false): TutorRequirement {
  return {
    id,
    name,
    isDefault,
    isActive: true,
    levelMin: 9,
    levelMax: 9,
    curricula: ["BANGLA_MEDIUM"],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 127,
    daysPerWeek: null,
    minSalary: null,
    maxStudents: 1,
    availableFrom: "2026-11-01",
    teachesOnline: false,
    subjectIds: [1],
    zoneIds: [],
  };
}

function mockSets(data: TutorRequirement[] | undefined) {
  vi.mocked(useTutorRequirements).mockReturnValue({
    data,
    isPending: data === undefined,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTutorRequirements>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useEducationLookup).mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useEducationLookup>);
  vi.mocked(useProfileSubjects).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof useProfileSubjects>);
});

describe("TutorRequirementsSection", () => {
  it("shows one set, then three after View more, then the all link", async () => {
    mockSets([
      set("1", "Set one", true),
      set("2", "Set two"),
      set("3", "Set three"),
      set("4", "Set four"),
      set("5", "Set five"),
    ]);
    render(<TutorRequirementsSection />);

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: "See all requirements" }),
    ).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "View more" }));

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(
      screen.getByRole("link", { name: "See all requirements" }),
    ).toHaveAttribute("href", "/dashboard/tutor/requirements");
  });

  it("shows the all link straight away when there is one set", () => {
    mockSets([set("1", "Only set", true)]);
    render(<TutorRequirementsSection />);

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "See all requirements" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View more" })).toBeNull();
    expect(screen.getByRole("link", { name: "New set" })).toBeInTheDocument();
  });

  it("shows the default badge, the classes description and the minimum salary", () => {
    mockSets([{ ...set("1", "Only set", true), minSalary: 6500 }]);
    render(<TutorRequirementsSection />);

    expect(
      screen.getByText("The classes, subjects and times you take."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Packages use/)).toBeNull();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("৳6,500")).toBeInTheDocument();
    expect(screen.getByText("/ month")).toBeInTheDocument();
    expect(screen.queryByText(/Used by/)).toBeNull();
  });

  it("shows the empty state when there are no sets", () => {
    mockSets([]);
    render(<TutorRequirementsSection />);

    expect(screen.queryByRole("link", { name: "New set" })).toBeNull();

    expect(
      screen.getByText(
        "You need a default set before you can apply to tuitions.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a set" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/requirements/new",
    );
  });
});
