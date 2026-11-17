import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TutorPackagesSection } from "@/components/packages/dashboard-section";
import { apiFetch } from "@/lib/api";
import type { MyPackage } from "@/lib/packages";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const LOOKUP = {
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
        { code: 10, label: "Class 10" },
      ],
      groups: [],
    },
  ],
  admissionTargets: [],
  retakerLabels: [],
};

function pkg(overrides: Partial<MyPackage> & { id: string }): MyPackage {
  return {
    tutor: {
      id: "tutor-1",
      name: "Rahim",
      gender: "MALE",
      ratingAvg: 0,
      ratingCount: 0,
    },
    title: "SSC Math Booster",
    description: "Full syllabus revision with weekly mock tests.",
    coverage: "FULL_CURRICULUM",
    durationWeeks: 12,
    price: 15000,
    subjectIds: [3],
    levelMin: 9,
    levelMax: 10,
    curricula: ["BANGLA_MEDIUM"],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 127,
    daysPerWeek: 3,
    maxStudents: 5,
    availableFrom: "2026-11-01",
    teachesOnline: true,
    zoneCount: 0,
    status: "OPEN",
    moderationStatus: "APPROVED",
    createdAt: "2026-11-01T00:00:00Z",
    closed: false,
    myApplication: null,
    zoneIds: [],
    moderationNote: null,
    updatedAt: "2026-11-01T00:00:00Z",
    pendingRequestCount: 0,
    requestCount: 0,
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockMine(packages: MyPackage[] | "error") {
  vi.mocked(apiFetch).mockImplementation(async (input: string) => {
    const { pathname } = new URL(String(input), "http://localhost");
    if (pathname === "/api/v1/packages/mine") {
      return packages === "error"
        ? json({ message: "boom" }, 500)
        : json({ packages });
    }
    if (pathname === "/api/v1/lookups/education") return json(LOOKUP);
    return json({ error: "unexpected" }, 500);
  });
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TutorPackagesSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TutorPackagesSection", () => {
  it("invites the first package when the tutor has none", async () => {
    mockMine([]);
    renderSection();

    expect(
      await screen.findByText("You have no packages yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a package" }),
    ).toHaveAttribute("href", "/dashboard/tutor/packages/new");
    // The empty card carries the only create button.
    expect(
      screen.queryByRole("link", { name: "New package" }),
    ).not.toBeInTheDocument();
  });

  it("lists up to two live packages with a link to all of them", async () => {
    mockMine([
      pkg({ id: "a", title: "Live one" }),
      pkg({ id: "b", title: "Live two" }),
      pkg({ id: "c", title: "Live three" }),
      pkg({ id: "d", title: "Old one", status: "EXPIRED" }),
    ]);
    renderSection();

    expect(
      await screen.findByRole("heading", { name: "Live one" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Live two" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Live three" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Old one" }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "See all packages" }),
    ).toHaveAttribute("href", "/dashboard/tutor/packages");
    expect(screen.getByRole("link", { name: "New package" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/packages/new",
    );
  });

  it("says so when every package is closed", async () => {
    mockMine([pkg({ id: "d", title: "Old one", status: "EXPIRED" })]);
    renderSection();

    expect(
      await screen.findByText("None of your packages are live right now."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Old one" }),
    ).not.toBeInTheDocument();
  });

  it("offers a retry when the list fails", async () => {
    mockMine("error");
    renderSection();

    const alert = await screen.findByText("Couldn't load your packages.");
    expect(
      within(alert.parentElement as HTMLElement).getByRole("button", {
        name: "Try again",
      }),
    ).toBeInTheDocument();
  });

  it("is labelled as the packages section of the dashboard", async () => {
    mockMine([]);
    renderSection();

    await screen.findByText("You have no packages yet.");
    const section = screen.getByRole("region", {
      name: "Your tuition packages",
    });
    expect(section).toHaveAttribute("id", "packages");
  });
});
