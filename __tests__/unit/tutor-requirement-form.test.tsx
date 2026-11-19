import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
import { ApiError, searchSubjects, type Option } from "@/lib/profile";
import { useTutorZones, type TutorZone } from "@/lib/tutor-zones";

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

vi.mock("@/lib/tutor-zones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor-zones")>()),
  useTutorZones: vi.fn(),
}));

function zone(id: string, label: string, radiusM = 2000): TutorZone {
  return {
    id,
    label,
    lat: 23.8,
    lng: 90.4,
    radiusM,
    placeId: null,
    addressText: null,
    requirementIds: [],
    packageIds: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
}

const ZONES: TutorZone[] = [
  zone("z1", "Dhanmondi"),
  zone("z2", "Mirpur", 3000),
];

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
  daysPerWeek: 3,
  minSalary: null,
  maxStudents: 1,
  availableFrom: "2026-11-01",
  teachesOnline: true,
  subjectIds: [1],
  zoneIds: [],
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

  vi.mocked(useTutorZones).mockReturnValue({
    data: { zones: ZONES, limit: 5, used: 2, pendingRequest: null },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTutorZones>);

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

  it("shows the zone error when no zone is picked and online is off", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Set name"), "Evening Math");
    await user.click(screen.getByRole("button", { name: "Math" }));
    await user.selectOptions(screen.getByLabelText("From"), "1");
    await user.selectOptions(screen.getByLabelText("To"), "8");
    await user.click(screen.getByRole("button", { name: "Create set" }));

    expect(
      await screen.findByText("Pick a zone or turn on online teaching."),
    ).toBeInTheDocument();
    expect(tutorRequirementApi.create).not.toHaveBeenCalled();
  });

  it("shows the zone error on load when editing a set with no zone and online off", () => {
    renderForm({ ...SET, teachesOnline: false, zoneIds: [] });

    expect(
      screen.getByText("Pick a zone or turn on online teaching."),
    ).toBeInTheDocument();
  });

  it("shows the server's INVALID_REQUIREMENT zone error on the Zones group", async () => {
    const user = userEvent.setup();
    vi.mocked(tutorRequirementApi.update).mockRejectedValue(
      new ApiError("Pick a zone or turn on online teaching", 400, {
        code: "INVALID_REQUIREMENT",
        details: { fields: ["zoneIds"] },
      }),
    );
    renderForm(SET);

    await user.clear(screen.getByLabelText("Set name"));
    await user.type(screen.getByLabelText("Set name"), "Renamed");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText("Pick a zone or turn on online teaching"),
    ).toBeInTheDocument();
  });

  it("adds a non-profile subject from search and syncs it to the profile", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Set name"), "Evening Math");
    await user.type(
      screen.getByPlaceholderText("Add a subject, like Physics"),
      "Phy",
    );
    await user.click(await screen.findByRole("option", { name: "Physics" }));

    expect(
      screen.getByText("Also adds Physics to your profile subjects."),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("From"), "1");
    await user.selectOptions(screen.getByLabelText("To"), "8");
    await user.click(
      screen.getByRole("checkbox", { name: "I also teach online" }),
    );
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

  it("offers a days-per-week choice that defaults to 3 on create", () => {
    renderForm();

    const group = screen.getByRole("radiogroup", { name: "Days per week" });
    expect(within(group).getByRole("radio", { name: "3" })).toBeChecked();
  });

  it("asks for a count when a saved set has none, instead of saving null", async () => {
    const user = userEvent.setup();
    renderForm({ ...SET, daysPerWeek: null });

    expect(screen.getByText("Any number of days")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Choose how many days a week."),
    ).toBeInTheDocument();
    expect(tutorRequirementApi.update).not.toHaveBeenCalled();
  });

  it("sends the picked daysPerWeek when editing", async () => {
    const user = userEvent.setup();
    renderForm(SET);

    const group = screen.getByRole("radiogroup", { name: "Days per week" });
    await user.click(within(group).getByRole("radio", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(tutorRequirementApi.update).toHaveBeenCalledWith("req-1", {
        daysPerWeek: 5,
      }),
    );
  });

  it("lists the tutor's zones as checkboxes in the Zones group", () => {
    renderForm();

    const group = screen.getByRole("group", { name: "Teaching zones" });
    expect(
      within(group).getByRole("checkbox", { name: "Dhanmondi · 2 km" }),
    ).not.toBeChecked();
    expect(
      within(group).getByRole("checkbox", { name: "Mirpur · 3 km" }),
    ).not.toBeChecked();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it("sends the chosen zoneIds when creating a set", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Set name"), "Evening Math");
    await user.click(screen.getByRole("button", { name: "Math" }));
    await user.selectOptions(screen.getByLabelText("From"), "1");
    await user.selectOptions(screen.getByLabelText("To"), "8");
    await user.click(screen.getByRole("checkbox", { name: "Mirpur · 3 km" }));
    await user.click(screen.getByRole("button", { name: "Create set" }));

    await waitFor(() =>
      expect(tutorRequirementApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ zoneIds: ["z2"] }),
      ),
    );
  });

  it("sends only the changed zoneIds when editing", async () => {
    const user = userEvent.setup();
    renderForm(SET);

    await user.click(
      screen.getByRole("checkbox", { name: "Dhanmondi · 2 km" }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(tutorRequirementApi.update).toHaveBeenCalledWith("req-1", {
        zoneIds: ["z1"],
      }),
    );
  });

  it("drops a zone that no longer exists before saving", async () => {
    const user = userEvent.setup();
    renderForm({ ...SET, zoneIds: ["z1", "deleted"] });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(tutorRequirementApi.update).toHaveBeenCalledWith("req-1", {
        zoneIds: ["z1"],
      }),
    );
  });

  it("shows the default-set hint until a zone or online teaching is chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    const hint =
      "To make this your default for applying, pick at least one zone or turn on online teaching.";
    expect(screen.getByText(hint)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Mirpur · 3 km" }));
    expect(screen.queryByText(hint)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Mirpur · 3 km" }));
    expect(screen.getByText(hint)).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "I also teach online" }),
    );
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });
});
