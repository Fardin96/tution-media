import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { TutorRequirementForm } from "@/components/tutor-requirements/tutor-requirement-form";
import {
  tutorRequirementApi,
  useProfileSubjects,
  type TutorRequirement,
} from "@/lib/tutor-requirements";
import { useEducationLookup, type EducationLookup } from "@/lib/education";
import { searchSubjects, type Option } from "@/lib/profile";

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

vi.mock("@/lib/tutor-requirements", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/tutor-requirements")>();
  return {
    ...actual,
    tutorRequirementApi: {
      ...actual.tutorRequirementApi,
      create: vi.fn(),
      update: vi.fn(),
    },
    useProfileSubjects: vi.fn(),
  };
});

vi.mock("@/lib/education", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/education")>()),
  useEducationLookup: vi.fn(),
}));

vi.mock("@/lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile")>()),
  searchSubjects: vi.fn(),
}));

const PROFILE_SUBJECTS: Option[] = [{ id: 1, name: "Math" }];
const ALL_SUBJECTS: Option[] = [
  { id: 1, name: "Math" },
  { id: 10, name: "Physics" },
];

const LOOKUP: EducationLookup = {
  version: 1,
  levelRange: { min: 0, max: 13 },
  groupLevels: { min: 9, max: 12 },
  admissionLevel: 13,
  levelNoteMaxLength: 40,
  curricula: [
    {
      code: "BANGLA_MEDIUM",
      label: "Bangla medium",
      levels: [
        { code: 1, label: "Class 1" },
        { code: 8, label: "Class 8" },
        { code: 13, label: "Admission & test prep" },
      ],
      groups: [{ code: "SCIENCE", label: "Science" }],
    },
  ],
  admissionTargets: [
    { code: "ENGINEERING", label: "Engineering", covers: "BUET, KUET, DUET" },
  ],
  retakerLabels: [],
};

const SET: TutorRequirement = {
  id: "req-1",
  name: "Evening Math",
  isDefault: false,
  isActive: true,
  levelMin: 1,
  levelMax: 8,
  curricula: ["BANGLA_MEDIUM"],
  academicGroups: [],
  admissionTargets: [],
  timeFrom: "16:00",
  timeTo: "18:00",
  availableDays: 127,
  minSalary: null,
  maxStudents: 1,
  availableFrom: "2026-11-01",
  teachesOnline: false,
  subjectIds: [1],
  zoneIds: [],
  mappedPackageCount: 0,
};

function renderForm(initialData?: TutorRequirement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TutorRequirementForm initialData={initialData} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useEducationLookup).mockReturnValue({
    data: LOOKUP,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useEducationLookup>);

  vi.mocked(useProfileSubjects).mockReturnValue({
    data: PROFILE_SUBJECTS,
    isPending: false,
    isSuccess: true,
  } as unknown as ReturnType<typeof useProfileSubjects>);

  vi.mocked(searchSubjects).mockImplementation(async (query: string) => {
    const q = query.trim().toLowerCase();
    return q
      ? ALL_SUBJECTS.filter((s) => s.name.toLowerCase().includes(q))
      : ALL_SUBJECTS;
  });

  vi.mocked(tutorRequirementApi.create).mockResolvedValue(SET);
  vi.mocked(tutorRequirementApi.update).mockResolvedValue(SET);
});

describe("TutorRequirementForm", () => {
  it("shows the name error when submitting an empty name", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Create set" }));

    expect(
      await screen.findByText("Give this set a name."),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Give this set a name.");
    expect(tutorRequirementApi.create).not.toHaveBeenCalled();
  });

  it("adds a non-profile subject from search and syncs it to the profile", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Set name"), "Evening Math");
    await user.type(
      screen.getByPlaceholderText("Add a subject, like Physics"),
      "Phy",
    );
    await user.click(await screen.findByRole("button", { name: "Physics" }));

    expect(
      screen.getByText("Also adds Physics to your profile subjects."),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("From"), "1");
    await user.selectOptions(screen.getByLabelText("To"), "8");
    await user.click(screen.getByRole("button", { name: "Create set" }));

    await waitFor(() =>
      expect(tutorRequirementApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Evening Math",
          subjectIds: [10],
          syncProfileSubjects: true,
        }),
      ),
    );
  });

  it("calls no API and says so when editing with no changes", async () => {
    const user = userEvent.setup();
    renderForm(SET);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("No changes to save."),
    );
    expect(tutorRequirementApi.update).not.toHaveBeenCalled();
    expect(tutorRequirementApi.create).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/dashboard/tutor/requirements");
  });

  it("shows the zones coming-soon text and no zone inputs", () => {
    renderForm();

    expect(
      screen.getByText(
        "Teaching zones are coming soon. Until then, students in your areas can find you.",
      ),
    ).toBeInTheDocument();
  });
});
