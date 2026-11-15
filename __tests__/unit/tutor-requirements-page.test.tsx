import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { TutorRequirementsPage } from "@/components/tutor-requirements/tutor-requirements-page";
import { useEducationLookup, type EducationLookup } from "@/lib/education";
import {
  tutorRequirementApi,
  useProfileSubjects,
  useTutorRequirements,
  type TutorRequirement,
} from "@/lib/tutor-requirements";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/dashboard/tutor/requirements",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/education", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/education")>()),
  useEducationLookup: vi.fn(),
}));

vi.mock("@/lib/tutor-requirements", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/tutor-requirements")>();
  return {
    ...actual,
    useTutorRequirements: vi.fn(),
    useProfileSubjects: vi.fn(),
    tutorRequirementApi: {
      ...actual.tutorRequirementApi,
      archive: vi.fn(),
      restore: vi.fn(),
      setDefault: vi.fn(),
    },
  };
});

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
        { code: 9, label: "Class 9" },
        { code: 12, label: "Class 12" },
      ],
      groups: [],
    },
  ],
  admissionTargets: [],
  retakerLabels: [],
};

function set(
  overrides: Partial<TutorRequirement> & { id: string; name: string },
): TutorRequirement {
  return {
    isDefault: false,
    isActive: true,
    levelMin: 9,
    levelMax: 9,
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
    ...overrides,
  };
}

function activeSets(count: number): TutorRequirement[] {
  return Array.from({ length: count }, (_, i) =>
    set({ id: `a${i}`, name: `Active ${i}`, isDefault: i === 0 }),
  );
}

function mockRequirements(data: TutorRequirement[] | undefined) {
  vi.mocked(useTutorRequirements).mockReturnValue({
    data,
    isPending: data === undefined,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTutorRequirements>);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TutorRequirementsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  vi.mocked(useEducationLookup).mockReturnValue({
    data: LOOKUP,
  } as unknown as ReturnType<typeof useEducationLookup>);
  vi.mocked(useProfileSubjects).mockReturnValue({
    data: [{ id: 1, name: "Bangla" }],
  } as unknown as ReturnType<typeof useProfileSubjects>);
});

describe("TutorRequirementsPage", () => {
  it("shows the active count and tab counts", () => {
    mockRequirements([
      set({ id: "d", name: "Main set", isDefault: true }),
      set({ id: "b", name: "Evening set" }),
      set({ id: "c", name: "Old set", isActive: false }),
    ]);
    renderPage();

    expect(screen.getByText("2 of 10 active")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active (2)" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Archived (1)" }),
    ).toBeInTheDocument();
  });

  it("lists archived sets with Restore on the Archived tab", () => {
    nav.search = "tab=archived";
    mockRequirements([
      set({ id: "d", name: "Main set", isDefault: true }),
      set({ id: "c", name: "Old set", isActive: false }),
    ]);
    renderPage();

    expect(screen.getByText("Old set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
  });

  it("switches tabs by writing ?tab=archived to the URL", async () => {
    mockRequirements([
      set({ id: "d", name: "Main set", isDefault: true }),
      set({ id: "c", name: "Old set", isActive: false }),
    ]);
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: "Archived (1)" }));

    expect(nav.replace).toHaveBeenCalledWith(
      "/dashboard/tutor/requirements?tab=archived",
      { scroll: false },
    );
  });

  it("disables Restore when the account already has 10 active sets", () => {
    nav.search = "tab=archived";
    mockRequirements([
      ...activeSets(10),
      set({ id: "c", name: "Old set", isActive: false }),
    ]);
    renderPage();

    const restore = screen.getByRole("button", { name: "Restore" });
    expect(restore).toBeDisabled();
    expect(restore).toHaveAttribute("title", "Archive an active set first");
  });

  it("replaces Restore with an Edit set link for a set with no subjects", () => {
    nav.search = "tab=archived";
    mockRequirements([
      set({ id: "d", name: "Main set", isDefault: true }),
      set({ id: "c", name: "Empty set", isActive: false, subjectIds: [] }),
    ]);
    renderPage();

    expect(
      screen.getByText("Add a subject before restoring."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit set" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/requirements/c/edit",
    );
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });

  it("archives a set and offers Undo in the toast", async () => {
    vi.mocked(tutorRequirementApi.archive).mockResolvedValue(
      set({ id: "b", name: "Evening set", isActive: false }),
    );
    mockRequirements([
      set({ id: "d", name: "Main set", isDefault: true }),
      set({ id: "b", name: "Evening set" }),
    ]);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(tutorRequirementApi.archive).toHaveBeenCalledWith("b"),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        "Set archived.",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Undo" }),
        }),
      ),
    );
  });

  it("shows no Archive button on the default set", () => {
    mockRequirements([
      set({ id: "d", name: "Main set", isDefault: true }),
      set({ id: "b", name: "Evening set" }),
    ]);
    renderPage();

    const defaultCard = screen
      .getByRole("heading", { name: "Main set" })
      .closest("article");
    expect(defaultCard).not.toBeNull();
    expect(
      within(defaultCard as HTMLElement).queryByRole("button", {
        name: "Archive",
      }),
    ).toBeNull();
    expect(screen.getAllByRole("button", { name: "Archive" })).toHaveLength(1);
  });
});
