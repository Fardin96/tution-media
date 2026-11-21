import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequirementsSection } from "@/components/profile/profile-dashboard";
import type { Requirement } from "@/lib/requirements";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/subjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subjects")>()),
  useSubjects: () => ({
    subjects: [{ id: 1, name: "Math" }],
    data: [{ id: 1, name: "Math" }],
  }),
}));

vi.mock("@/lib/areas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/areas")>()),
  useAreas: () => ({ areas: [], data: [] }),
}));

vi.mock("@/lib/education", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/education")>()),
  useEducationLookup: () => ({ data: undefined }),
}));

function requirement(id: string, status: Requirement["status"]): Requirement {
  return {
    id,
    studentId: "stu-1",
    areaId: null,
    subjectIds: [1],
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
    hireByDate: "2026-12-01",
    tutorGenderPref: "ANY",
    instituteName: null,
    tuitionType: null,
    status,
    createdAt: "2026-05-01T04:00:00Z",
    updatedAt: "2026-05-01T04:00:00Z",
  };
}

const REQUIREMENTS: Requirement[] = [
  requirement("open-1", "OPEN"),
  requirement("draft-1", "DRAFT"),
  requirement("closed-1", "CLOSED"),
  requirement("filled-1", "FILLED"),
  requirement("expired-1", "EXPIRED"),
];

function renderSection() {
  return render(
    <RequirementsSection
      requirements={REQUIREMENTS}
      onUpdateRequirement={vi.fn()}
    />,
  );
}

/** The card (list item) that holds a status pill with this label. */
function cardWith(label: string): HTMLElement {
  const card = screen.getByText(label).closest("li");
  if (!card) throw new Error(`no card for ${label}`);
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RequirementsSection cards", () => {
  it("shows the posted date on every card", async () => {
    const user = userEvent.setup();
    renderSection();
    // Open and draft cards show at once; one past card until "View more" is pressed.
    expect(screen.getAllByText("Posted 1 May 2026")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "View more" }));
    expect(screen.getAllByText("Posted 1 May 2026")).toHaveLength(5);
  });

  it("does not offer Post again on open and draft requirements", () => {
    renderSection();
    expect(
      within(cardWith("Open")).queryByRole("link", { name: /Post again/ }),
    ).not.toBeInTheDocument();
    expect(
      within(cardWith("Draft")).queryByRole("link", { name: /Post again/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Post again on closed, filled and expired requirements", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: "View more" }));

    const links = screen.getAllByRole("link", { name: /^Post again/ });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard/requirements/new?from=closed-1",
      "/dashboard/requirements/new?from=filled-1",
      "/dashboard/requirements/new?from=expired-1",
    ]);
  });

  it("shows a filled requirement as hired, with no Edit or Close", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: "View more" }));

    const filled = cardWith("Tutor hired");
    expect(within(filled).queryByRole("link", { name: /^Edit/ })).toBeNull();
    expect(
      within(filled).queryByRole("button", { name: /^Close/ }),
    ).not.toBeInTheDocument();
    expect(
      within(filled).queryByRole("link", { name: /^Applicants/ }),
    ).toBeNull();
  });

  it("keeps Edit and Close on open requirements", () => {
    renderSection();
    const open = cardWith("Open");
    expect(within(open).getByRole("link", { name: /^Edit/ })).toHaveAttribute(
      "href",
      "/dashboard/requirements/open-1/edit",
    );
    expect(
      within(open).getByRole("button", { name: /^Close/ }),
    ).toBeInTheDocument();
  });
});
