import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostAgainView } from "@/components/requirements/post-again-view";
import { requirementApi, type Requirement } from "@/lib/requirements";
import {
  ApiError,
  searchAreas,
  searchSubjects,
  type Option,
} from "@/lib/profile";
import { useAreas } from "@/lib/areas";
import { useSubjects } from "@/lib/subjects";
import { useEducationLookup } from "@/lib/education";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/requirements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/requirements")>();
  return {
    ...actual,
    requirementApi: {
      ...actual.requirementApi,
      get: vi.fn(),
      mine: vi.fn(),
      create: vi.fn(),
    },
  };
});

vi.mock("@/lib/subjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subjects")>()),
  useSubjects: vi.fn(),
}));

vi.mock("@/lib/areas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/areas")>()),
  useAreas: vi.fn(),
}));

vi.mock("@/lib/education", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/education")>()),
  useEducationLookup: vi.fn(),
}));

vi.mock("@/lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile")>()),
  searchSubjects: vi.fn(),
  searchAreas: vi.fn(),
}));

const SUBJECTS: Option[] = [{ id: 1, name: "Math" }];
const AREAS: Option[] = [{ id: 3, name: "Dhanmondi" }];

const SOURCE: Requirement = {
  institutionId: null,
  id: "req-old",
  studentId: "stu-1",
  areaId: 3,
  subjectIds: [1],
  curriculum: null,
  levelCode: null,
  academicGroup: null,
  admissionTargets: [],
  isRetaker: false,
  levelNote: null,
  timeOfDay: "18:00",
  daysPerWeek: 3,
  availableDays: 127,
  salary: 8000,
  studentCount: 1,
  hireByDate: "2026-10-01",
  tutorGenderPref: "ANY",
  instituteName: "Viqarunnisa Noon School",
  tuitionType: "Online",
  status: "CLOSED",
  createdAt: "2026-05-01T04:00:00Z",
  updatedAt: "2026-06-01T04:00:00Z",
};

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PostAgainView fromId="req-old" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSubjects).mockReturnValue({
    data: SUBJECTS,
    subjects: SUBJECTS,
    isError: false,
  } as unknown as ReturnType<typeof useSubjects>);
  vi.mocked(useAreas).mockReturnValue({
    data: AREAS,
    areas: AREAS,
    isError: false,
  } as unknown as ReturnType<typeof useAreas>);
  vi.mocked(useEducationLookup).mockReturnValue({
    data: undefined,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useEducationLookup>);
  vi.mocked(searchSubjects).mockResolvedValue(SUBJECTS);
  vi.mocked(searchAreas).mockResolvedValue(AREAS);
  vi.mocked(requirementApi.mine).mockResolvedValue([]);
});

describe("PostAgainView", () => {
  it("copies the source into the form once it has loaded", async () => {
    vi.mocked(requirementApi.get).mockResolvedValue(SOURCE);
    renderView();

    expect(
      await screen.findByText(
        "Copied from your requirement posted on 1 May 2026. Check the class, time and salary before posting.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "School or college" }),
    ).toHaveValue("Viqarunnisa Noon School");
    expect(requirementApi.get).toHaveBeenCalledWith("req-old");
  });

  it("shows a notice and a blank form when the source cannot be loaded", async () => {
    vi.mocked(requirementApi.get).mockRejectedValue(
      new ApiError("Not found", 404),
    );
    renderView();

    expect(
      await screen.findByText(
        "We couldn't copy that requirement. Start from a blank form.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Post requirement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "School or college" }),
    ).toHaveValue("");
    expect(requirementApi.get).toHaveBeenCalledTimes(1);
  });
});
