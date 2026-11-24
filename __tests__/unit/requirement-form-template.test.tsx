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
  useMeAccount,
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
  useMeAccount: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lib/phone-verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/phone-verification")>()),
  usePhoneVerificationStatus: () => ({ data: undefined }),
}));

// The lookup lists report loaded, so a draft is checked against them straight away.
vi.mock("@/lib/subjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subjects")>()),
  useSubjects: () => ({ subjects: SUBJECTS, isSuccess: true, isFetched: true }),
}));

vi.mock("@/lib/areas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/areas")>()),
  useAreas: () => ({ areas: AREAS, isSuccess: true, isFetched: true }),
}));

// The in-place dialog has its own tests; here it only shows what it was given.
vi.mock("@/components/profile/phone-verify-in-place", () => ({
  PhoneVerifyInPlace: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Verify your phone</div> : null,
}));

const SUBJECTS: Option[] = [
  { id: 1, name: "Math" },
  { id: 2, name: "English" },
];
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
  institutionId: null,
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
  vi.mocked(useMeAccount).mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useMeAccount>);
  window.localStorage.clear();
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

const ACCOUNT_KEY = "draft:v1:acc-1:requirement";
const COPY_KEY = "draft:v1:acc-1:requirement:from:req-prev";

function asAccount(id: string) {
  vi.mocked(useMeAccount).mockReturnValue({
    data: { id },
  } as unknown as ReturnType<typeof useMeAccount>);
}

function seed(key: string, value: unknown) {
  window.localStorage.setItem(
    key,
    JSON.stringify({ v: 1, savedAt: Date.now() - 60_000, value }),
  );
}

function renderBlank() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RequirementForm />
    </QueryClientProvider>,
  );
}

describe("RequirementForm drafts", () => {
  it("restores a draft, drops a pick that is gone and resets a past hire-by date", async () => {
    const user = userEvent.setup();
    asAccount("acc-1");
    seed(
      ACCOUNT_KEY,
      template({ subjectIds: [1, 999], hireByDate: "2020-01-01" }),
    );
    renderBlank();

    expect(
      await screen.findByText(/Restored your draft from 1 minute ago/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Hire by date")).toHaveValue(
      emptyRequirementForm().hireByDate,
    );

    await user.click(screen.getByRole("button", { name: "Post requirement" }));
    await waitFor(() => expect(requirementApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(requirementApi.create).mock.calls[0][0]).toMatchObject({
      subjectIds: [1],
    });
  });

  it("Post again: Start over goes back to the copied requirement, not a blank form", async () => {
    const user = userEvent.setup();
    asAccount("acc-1");
    seed(COPY_KEY, template({ instituteName: "Changed school" }));
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <RequirementForm
          template={template()}
          templateNotes={NOTES}
          fromId="req-prev"
        />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Start over" }));
    expect(screen.getByLabelText("School or college")).toHaveValue(
      "Viqarunnisa Noon School",
    );
    expect(window.localStorage.getItem(COPY_KEY)).toBeNull();
  });

  it("Start over after the class prefill keeps the prefill and writes no draft", async () => {
    const user = userEvent.setup();
    asAccount("acc-1");
    vi.mocked(requirementApi.mine).mockResolvedValue([PREVIOUS]);
    seed(ACCOUNT_KEY, template({ instituteName: "Draft school" }));
    renderBlank();

    await user.click(await screen.findByRole("button", { name: "Start over" }));
    expect(window.localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    // Past the 500 ms save delay: an untouched form must not come back as a draft.
    await new Promise((r) => setTimeout(r, 700));
    expect(window.localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(screen.queryByText(/Restored your draft/)).toBeNull();
  });

  it("clears the draft after a successful post", async () => {
    const user = userEvent.setup();
    asAccount("acc-1");
    seed(ACCOUNT_KEY, template());
    renderBlank();

    await user.click(
      await screen.findByRole("button", { name: "Post requirement" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(window.localStorage.getItem(ACCOUNT_KEY)).toBeNull();
  });

  it("keeps the draft after a failed post", async () => {
    const user = userEvent.setup();
    asAccount("acc-1");
    seed(ACCOUNT_KEY, template());
    vi.mocked(requirementApi.create).mockRejectedValue(
      new ApiError("Server", 500, { code: "INTERNAL_ERROR" }),
    );
    renderBlank();

    await user.click(
      await screen.findByRole("button", { name: "Post requirement" }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(window.localStorage.getItem(ACCOUNT_KEY)).not.toBeNull();
  });

  it("does not restore another account's draft", () => {
    asAccount("acc-2");
    seed(ACCOUNT_KEY, template());
    renderBlank();
    expect(screen.queryByText(/Restored your draft/)).toBeNull();
  });

  it("a phone verification refusal opens the in-place verify and keeps what was typed", async () => {
    const user = userEvent.setup();
    vi.mocked(requirementApi.create).mockRejectedValue(
      new ApiError("Verify", 403, { code: "PHONE_VERIFICATION_REQUIRED" }),
    );
    renderForm(template());

    await user.clear(screen.getByLabelText("School or college"));
    await user.type(screen.getByLabelText("School or college"), "Kept school");
    await user.click(screen.getByRole("button", { name: "Post requirement" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [, options] = vi.mocked(toast.error).mock.calls[0];
    (
      options as unknown as { action: { onClick: () => void } }
    ).action.onClick();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("School or college")).toHaveValue(
      "Kept school",
    );
  });
});
