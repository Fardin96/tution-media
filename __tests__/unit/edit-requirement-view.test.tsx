import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditRequirementView } from "@/components/requirements/edit-requirement-view";
import { requirementApi, type Requirement } from "@/lib/requirements";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// The open-requirement case renders the full form, whose subject, area and class lookups
// would otherwise hit the network. They stay pending; this file only checks which view shows.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/lib/requirements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/requirements")>();
  return {
    ...actual,
    requirementApi: { ...actual.requirementApi, get: vi.fn() },
  };
});

function requirement(status: string): Requirement {
  return {
    institutionId: null,
    id: "req-1",
    studentId: "stu-1",
    areaId: null,
    subjectIds: [],
    curriculum: null,
    levelCode: null,
    academicGroup: null,
    admissionTargets: [],
    isRetaker: false,
    levelNote: null,
    timeOfDay: null,
    daysPerWeek: null,
    availableDays: 127,
    salary: null,
    studentCount: null,
    hireByDate: null,
    tutorGenderPref: "ANY",
    instituteName: null,
    tuitionType: null,
    status: status as Requirement["status"],
    createdAt: "2026-05-01T04:00:00Z",
    updatedAt: "2026-05-01T04:00:00Z",
  };
}

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditRequirementView id="req-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditRequirementView", () => {
  it.each([
    ["CLOSED", "This requirement is closed, so it can't be edited."],
    ["FILLED", "A tutor is hired for this requirement, so it can't be edited."],
    ["EXPIRED", "This requirement has expired, so it can't be edited."],
  ])(
    "blocks a %s requirement and offers Post again",
    async (status, message) => {
      vi.mocked(requirementApi.get).mockResolvedValue(requirement(status));
      renderView();

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Post again" })).toHaveAttribute(
        "href",
        "/dashboard/requirements/new?from=req-1",
      );
      expect(
        screen.queryByRole("button", { name: "Save changes" }),
      ).not.toBeInTheDocument();
    },
  );

  it("shows the form for an open requirement", async () => {
    vi.mocked(requirementApi.get).mockResolvedValue(requirement("OPEN"));
    renderView();

    expect(
      await screen.findByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Post again" }),
    ).not.toBeInTheDocument();
  });
});
