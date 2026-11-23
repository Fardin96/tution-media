import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackageForm } from "@/components/packages/package-form";
import { apiFetch } from "@/lib/api";
import { usePackageReadiness, type MyPackage } from "@/lib/packages";
import { useEducationLookup, type EducationLookup } from "@/lib/education";
import { searchSubjects, type Option } from "@/lib/profile";
import { useProfileSubjects } from "@/lib/tutor-requirements";
import { useTutorZones, type TutorZone } from "@/lib/tutor-zones";

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

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/packages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/packages")>()),
  usePackageReadiness: vi.fn(),
}));

vi.mock("@/lib/tutor-requirements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor-requirements")>()),
  useProfileSubjects: vi.fn(),
}));

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

function zone(id: string, label: string): TutorZone {
  return {
    id,
    label,
    lat: 23.8,
    lng: 90.4,
    radiusM: 2000,
    placeId: null,
    addressText: null,
    requirementIds: [],
    packageIds: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
}

const ZONES: TutorZone[] = [zone("z1", "Dhanmondi"), zone("z2", "Mirpur")];

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
  admissionTargets: [],
  retakerLabels: [],
};

const PACKAGE: MyPackage = {
  id: "pkg-1",
  tutor: {
    id: "tutor-1",
    name: "Rahim",
    avatarUrl: null,
    gender: "MALE",
    ratingAvg: 0,
    ratingCount: 0,
  },
  title: "SSC Math Booster",
  description: "Full syllabus revision with weekly mock tests.",
  coverage: "FULL_CURRICULUM",
  durationWeeks: 12,
  price: 15000,
  subjectIds: [1],
  levelMin: 1,
  levelMax: 8,
  curricula: ["BANGLA_MEDIUM"],
  academicGroups: [],
  admissionTargets: [],
  timeFrom: "16:00",
  timeTo: "18:00",
  availableDays: 127,
  daysPerWeek: 3,
  maxStudents: 5,
  availableFrom: "2026-11-20",
  teachesOnline: false,
  zoneCount: 1,
  status: "OPEN",
  moderationStatus: "APPROVED",
  createdAt: "2026-11-01T00:00:00Z",
  closed: false,
  myApplication: null,
  zoneIds: ["z1"],
  moderationNote: null,
  updatedAt: "2026-11-01T00:00:00Z",
  pendingRequestCount: 0,
  requestCount: 0,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setReadiness(missing: string[]) {
  vi.mocked(usePackageReadiness).mockReturnValue({
    data: { applyReadiness: { ready: missing.length === 0, missing } },
    dataUpdatedAt: 1,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof usePackageReadiness>);
}

/** The body of the first request with this method, parsed. */
function sentBody(method: string): Record<string, unknown> | undefined {
  const call = vi
    .mocked(apiFetch)
    .mock.calls.find(([, init]) => init?.method === method);
  if (!call) return undefined;
  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

function renderForm(initial?: MyPackage) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      {initial ? (
        <PackageForm mode="edit" initial={initial} />
      ) : (
        <PackageForm mode="create" />
      )}
    </QueryClientProvider>,
  );
}

/** Fills every required create field; the subject is picked from the search. */
async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  subject: { query: string; name: string } = { query: "Mat", name: "Math" },
) {
  await user.type(screen.getByLabelText("Title"), "SSC Math Booster");
  await user.type(
    screen.getByLabelText("What it covers"),
    "Full syllabus revision with weekly mock tests.",
  );
  await user.type(screen.getByLabelText("Duration (weeks)"), "12");
  await user.type(
    screen.getByPlaceholderText("Add a subject, like Physics"),
    subject.query,
  );
  await user.click(await screen.findByRole("option", { name: subject.name }));
  await user.selectOptions(screen.getByLabelText("From"), "1");
  await user.selectOptions(screen.getByLabelText("To"), "8");
  await user.type(
    screen.getByLabelText("Price for the whole package (taka)"),
    "15000",
  );
  await user.click(
    screen.getByRole("checkbox", { name: "I also teach online" }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(apiFetch).mockResolvedValue(json(PACKAGE));
  setReadiness([]);

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
});

describe("PackageForm create", () => {
  it("shows the field errors inline, focuses the first one, and skips the toast", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Publish package" }));

    expect(
      await screen.findByText("Give this package a title."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Describe what the package covers."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pick a zone or turn on online teaching."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveFocus());
    expect(toast.error).not.toHaveBeenCalled();
    expect(sentBody("POST")).toBeUndefined();
  });

  it("counts the description against its 600 character limit", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByText("0 / 600")).toBeInTheDocument();
    await user.type(screen.getByLabelText("What it covers"), "Full");
    expect(screen.getByText("4 / 600")).toBeInTheDocument();
  });

  it("offers full curriculum and part of the curriculum as one choice", async () => {
    const user = userEvent.setup();
    renderForm();

    const group = screen.getByRole("radiogroup", { name: "Coverage" });
    expect(
      within(group).getByRole("radio", { name: "Full curriculum" }),
    ).toBeChecked();

    await user.click(
      within(group).getByRole("radio", { name: "Part of the curriculum" }),
    );
    expect(
      within(group).getByRole("radio", { name: "Part of the curriculum" }),
    ).toBeChecked();
  });

  it("publishes a complete package with the whole-package price", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Publish package" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Package sent for review"),
    );
    expect(push).toHaveBeenCalledWith("/dashboard/tutor/packages");
    expect(sentBody("POST")).toMatchObject({
      title: "SSC Math Booster",
      description: "Full syllabus revision with weekly mock tests.",
      coverage: "FULL_CURRICULUM",
      durationWeeks: 12,
      price: 15000,
      subjectIds: [1],
      levelMin: 1,
      levelMax: 8,
      teachesOnline: true,
      zoneIds: [],
      maxStudents: 1,
      daysPerWeek: 3,
    });
    expect(sentBody("POST")).not.toHaveProperty("syncProfileSubjects");
  });

  it("asks the API to add a subject that is not on the profile", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValidForm(user, { query: "Phy", name: "Physics" });
    await user.click(screen.getByRole("button", { name: "Publish package" }));

    await waitFor(() =>
      expect(sentBody("POST")).toMatchObject({
        subjectIds: [10],
        syncProfileSubjects: true,
      }),
    );
  });

  it("blocks publishing and shows the checklist when the profile is incomplete", async () => {
    const user = userEvent.setup();
    setReadiness(["name", "default_requirement", "verification"]);
    renderForm();

    const heading = screen.getByRole("heading", {
      name: "Finish your profile to publish",
    });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your name" })).toHaveAttribute(
      "href",
      "/dashboard#profile",
    );
    expect(
      screen.getByRole("link", { name: "Get your profile verified" }),
    ).toHaveAttribute("href", "/dashboard#verification");
    // Packages don't need a default set, so that row is never shown.
    expect(
      screen.queryByRole("link", { name: "Create a default requirement set" }),
    ).not.toBeInTheDocument();

    const publish = screen.getByRole("button", { name: "Publish package" });
    expect(publish).toHaveAttribute("aria-disabled", "true");
    expect(publish).toHaveAccessibleDescription("Finish your profile first.");

    await fillValidForm(user);
    await user.click(publish);

    expect(sentBody("POST")).toBeUndefined();
  });

  it("does not block on a default requirement set alone", () => {
    setReadiness(["default_requirement"]);
    renderForm();

    expect(
      screen.queryByRole("heading", {
        name: "Finish your profile to publish",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish package" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("shows the checklist from a 403 and points up with one toast", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValueOnce(
      json(
        {
          code: "PROFILE_INCOMPLETE",
          message: "Profile incomplete",
          details: { missing: ["phone_verification"] },
        },
        403,
      ),
    );
    renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Publish package" }));

    expect(
      await screen.findByRole("link", { name: "Verify your phone number" }),
    ).toHaveAttribute("href", "/dashboard#phone-verification");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Finish your profile to publish.");
    expect(push).not.toHaveBeenCalled();
  });

  it("puts an INVALID_REQUIREMENT zone error next to the zones, without a toast", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValueOnce(
      json(
        {
          code: "INVALID_REQUIREMENT",
          message: "Invalid",
          details: { fields: ["zoneIds"] },
        },
        400,
      ),
    );
    renderForm();

    await fillValidForm(user);
    await user.click(
      screen.getByRole("checkbox", { name: "I also teach online" }),
    );
    await user.click(screen.getByRole("checkbox", { name: /Dhanmondi/ }));
    await user.click(screen.getByRole("button", { name: "Publish package" }));

    expect(
      await screen.findByText("Pick only zones you've added."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("maps validation issues from the server to their fields", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValueOnce(
      json(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          issues: [{ path: ["body", "title"], message: "Title is too short" }],
        },
        400,
      ),
    );
    renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Publish package" }));

    expect(await screen.findByText("Title is too short")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts any other failure", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValueOnce(json({ message: "boom" }, 500));
    renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Publish package" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't save this package. Try again.",
      ),
    );
  });
});

describe("PackageForm edit", () => {
  it("fills the form from the package", () => {
    renderForm(PACKAGE);

    expect(screen.getByLabelText("Title")).toHaveValue("SSC Math Booster");
    expect(screen.getByLabelText("Duration (weeks)")).toHaveValue(12);
    expect(
      screen.getByLabelText("Price for the whole package (taka)"),
    ).toHaveValue("15000");
    expect(screen.getByLabelText("Max students")).toHaveValue(5);
  });

  it("says so and sends nothing when no field changed", async () => {
    const user = userEvent.setup();
    renderForm(PACKAGE);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("No changes to save."),
    );
    expect(sentBody("PATCH")).toBeUndefined();
    expect(push).toHaveBeenCalledWith("/dashboard/tutor/packages");
  });

  it("sends only the price when only the price changed", async () => {
    const user = userEvent.setup();
    renderForm(PACKAGE);

    const price = screen.getByLabelText("Price for the whole package (taka)");
    await user.clear(price);
    await user.type(price, "16000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Changes saved."),
    );
    expect(sentBody("PATCH")).toEqual({ price: 16000 });
  });

  it("says the package is sent for review again when a rejected package is saved", async () => {
    const user = userEvent.setup();
    renderForm({
      ...PACKAGE,
      moderationStatus: "REJECTED",
      moderationNote: "Add the class range.",
    });

    const price = screen.getByLabelText("Price for the whole package (taka)");
    await user.clear(price);
    await user.type(price, "16000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Package sent for review again",
      ),
    );
  });
});
