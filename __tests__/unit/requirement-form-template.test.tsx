import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { RequirementForm } from "@/components/requirements/requirement-form";
import {
  emptyRequirementForm,
  requirementApi,
  type Requirement,
  type RequirementForm as FormState,
  type RequirementTemplateNotes,
} from "@/lib/requirements";
import { useEducationLookup, type EducationLookup } from "@/lib/education";
import {
  ApiError,
  searchAreas,
  searchSubjects,
  type Option,
} from "@/lib/profile";

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
      create: vi.fn(),
      update: vi.fn(),
      mine: vi.fn(),
    },
  };
});

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
        { code: 8, label: "Class 8" },
        { code: 9, label: "Class 9" },
      ],
      groups: [{ code: "SCIENCE", label: "Science" }],
    },
  ],
  admissionTargets: [],
  retakerLabels: [],
};

const NOTES: RequirementTemplateNotes = {
  postedOn: "2026-05-01T04:00:00Z",
  removedSubjects: 2,
  areaCleared: true,
  tuitionTypeReset: true,
  checkClass: true,
};

/** A complete, valid form so a submit reaches the API. */
function template(overrides: Partial<FormState> = {}): FormState {
  return {
    ...emptyRequirementForm(),
    subjectIds: [1],
    curriculum: "BANGLA_MEDIUM",
    levelCode: 9,
    instituteName: "Viqarunnisa Noon School",
    areaId: 3,
    timeOfDay: "18:00",
    salary: "8,000",
    ...overrides,
  };
}

const PREVIOUS: Requirement = {
  id: "req-prev",
  studentId: "stu-1",
  areaId: 3,
  subjectIds: [1],
  curriculum: "BANGLA_MEDIUM",
  levelCode: 5,
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
  status: "OPEN",
  createdAt: "2026-11-01T04:00:00Z",
  updatedAt: "2026-11-01T04:00:00Z",
};

function renderForm(form: FormState, notes?: RequirementTemplateNotes) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RequirementForm template={form} templateNotes={notes} />
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
  vi.mocked(searchSubjects).mockResolvedValue(SUBJECTS);
  vi.mocked(searchAreas).mockResolvedValue(AREAS);
  vi.mocked(requirementApi.mine).mockResolvedValue([]);
  vi.mocked(requirementApi.create).mockResolvedValue({} as Requirement);
});

describe("RequirementForm with a copied requirement", () => {
  it("shows what was copied, what was removed and the class hint", () => {
    renderForm(template(), NOTES);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(
      "Copied from your requirement posted on 1 May 2026. Check the class, time and salary before posting.",
    );
    expect(notice).toHaveTextContent(
      "Removed 2 subjects that are no longer offered.",
    );
    expect(notice).toHaveTextContent(
      "Pick the area again. The old one is no longer available.",
    );
    expect(notice).toHaveTextContent("Pick the tuition type again.");

    expect(screen.getByLabelText("Class")).toHaveAccessibleDescription(
      "Posted over 6 months ago. Check the class.",
    );
  });

  it("uses the singular for one removed subject and leaves out lines that do not apply", () => {
    renderForm(template(), {
      ...NOTES,
      removedSubjects: 1,
      areaCleared: false,
      tuitionTypeReset: false,
      checkClass: false,
    });

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(
      "Removed 1 subject that's no longer offered.",
    );
    expect(notice).not.toHaveTextContent("Pick the area again");
    expect(notice).not.toHaveTextContent("Pick the tuition type again");
    expect(
      screen.queryByText("Posted over 6 months ago. Check the class."),
    ).not.toBeInTheDocument();
  });

  it("posts as a new requirement, never an update", async () => {
    const user = userEvent.setup();
    renderForm(template(), NOTES);

    await user.click(screen.getByRole("button", { name: "Post requirement" }));

    await waitFor(() => expect(requirementApi.create).toHaveBeenCalledTimes(1));
    expect(requirementApi.update).not.toHaveBeenCalled();
    expect(vi.mocked(requirementApi.create).mock.calls[0][0]).toMatchObject({
      subjectIds: [1],
      curriculum: "BANGLA_MEDIUM",
      levelCode: 9,
      status: "OPEN",
    });
  });

  it("does not prefill the class from the newest requirement", async () => {
    vi.mocked(requirementApi.mine).mockResolvedValue([PREVIOUS]);
    renderForm(template({ levelCode: null }), NOTES);

    await waitFor(() => expect(requirementApi.mine).not.toHaveBeenCalled());
    expect(screen.getByLabelText("Class")).toHaveValue("");
  });

  it("links to the open requirement when the server reports a duplicate", async () => {
    const user = userEvent.setup();
    vi.mocked(requirementApi.create).mockRejectedValue(
      new ApiError("Duplicate", 409, {
        code: "REQUIREMENT_DUPLICATE",
        details: { requirementId: "req-open-9" },
      }),
    );
    renderForm(template(), NOTES);

    await user.click(screen.getByRole("button", { name: "Post requirement" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You already have an open requirement like this one. Edit it instead.",
        expect.objectContaining({ id: "requirement-duplicate" }),
      ),
    );
    const [, options] = vi.mocked(toast.error).mock.calls[0];
    const description = (options as { description: React.ReactNode })
      .description;
    render(<div>{description}</div>);
    expect(
      screen.getByRole("link", { name: "Edit the open requirement" }),
    ).toHaveAttribute("href", "/dashboard/requirements/req-open-9/edit");
  });
});
