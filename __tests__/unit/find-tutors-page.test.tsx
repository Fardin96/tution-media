import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FindTutorsPage } from "@/components/browse/find-tutors-page";
import { PackageCard } from "@/components/browse/package-card";
import { apiFetch } from "@/lib/api";
import type { TuitionPackage } from "@/lib/browse";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

const AREA_OPTIONS = [
  "Dhanmondi",
  "Gulshan",
  "Banani",
  "Uttara",
  "Mirpur",
  "Mohammadpur",
  "Bashundhara",
  "Badda",
  "Rampura",
  "Khilgaon",
  "Motijheel",
  "Old Dhaka",
  "Lalmatia",
  "Tejgaon",
  "Farmgate",
  "Shyamoli",
  "Malibagh",
  "Moghbazar",
  "Wari",
  "Jatrabari",
].map((name, i) => ({ id: i + 1, name }));

vi.mock("@/lib/areas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/areas")>()),
  useAreas: () => ({ areas: AREA_OPTIONS }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/dashboard/find-tutors",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

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
        { code: 12, label: "Class 12" },
      ],
      groups: [],
    },
  ],
  admissionTargets: [],
  retakerLabels: [],
};

function pkg(overrides: Partial<TuitionPackage> = {}): TuitionPackage {
  return {
    id: "pkg-1",
    tutor: {
      id: "tutor-1",
      name: "Nusrat Jahan",
      gender: "FEMALE",
      ratingAvg: 4.5,
      ratingCount: 12,
    },
    title: "Class 9 maths catch-up",
    description: "Covers the class 9 syllabus, one topic a week.",
    coverage: "PARTIAL",
    durationWeeks: 12,
    price: 15000,
    subjectIds: [3],
    levelMin: 9,
    levelMax: 9,
    curricula: ["BANGLA_MEDIUM"],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 5,
    daysPerWeek: 3,
    maxStudents: 2,
    availableFrom: "2026-12-01",
    teachesOnline: false,
    zoneCount: 1,
    status: "OPEN",
    moderationStatus: "APPROVED",
    createdAt: "2026-11-01T00:00:00.000Z",
    closed: false,
    myApplication: null,
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockPackages(packages: TuitionPackage[]) {
  vi.mocked(apiFetch).mockImplementation(async (input: string) => {
    const { pathname } = new URL(String(input), "http://localhost");
    if (pathname === "/api/v1/packages") {
      return json({ packages, nextCursor: null, locationMissing: false });
    }
    if (pathname === "/api/v1/lookups/education") return json(LOOKUP);
    return json({ error: "unexpected" }, 500);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FindTutorsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nav.search = "";
  nav.replace.mockClear();
  vi.mocked(apiFetch).mockReset();
});

describe("FindTutorsPage packages tab", () => {
  it("shows the placeholder when there are no packages yet", async () => {
    nav.search = "tab=packages";
    mockPackages([]);

    renderPage();

    expect(await screen.findByText("No packages found")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No packages match these filters yet. Browse tutors or post a requirement instead.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Post a requirement" }),
    ).toHaveAttribute("href", "/dashboard/requirements/new");
  });

  it("writes ?tab=packages when the Packages tab is selected", async () => {
    mockPackages([]);
    const user = userEvent.setup();

    renderPage();
    await user.click(screen.getByRole("tab", { name: "Packages" }));

    expect(nav.replace).toHaveBeenCalledWith(
      "/dashboard/find-tutors?tab=packages",
      { scroll: false },
    );
  });

  it("shows Application closed on a closed package card", async () => {
    nav.search = "tab=packages";
    mockPackages([pkg({ closed: true })]);

    renderPage();

    expect(await screen.findByText("Application closed")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View package/ }),
    ).not.toBeInTheDocument();
  });

  it("links an open package to its detail page", async () => {
    nav.search = "tab=packages";
    mockPackages([pkg({ id: "pkg-open" })]);

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /View package/ }),
      ).toHaveAttribute("href", "/dashboard/find-tutors/packages/pkg-open"),
    );
  });
});

describe("FindTutorsPage tutors tab", () => {
  const NEARBY = [
    {
      id: "tutor-1",
      name: "Nusrat Jahan",
      instituteName: "University of Dhaka",
      gender: "FEMALE",
      ratingAvg: 4.5,
      ratingCount: 12,
      distanceMeters: 2500,
      areas: [
        { id: 1, name: "Dhanmondi" },
        { id: 2, name: "Banani" },
      ],
      subjects: [{ id: 5, name: "Physics" }],
    },
  ];

  const SEARCH = [
    {
      id: "tutor-2",
      name: "Rafi Ahmed",
      instituteName: "BUET",
      gender: "MALE",
      ratingAvg: 0,
      ratingCount: 0,
      areas: [{ id: 2, name: "Banani" }],
      subjects: [{ id: 7, name: "Chemistry" }],
    },
  ];

  function mockTutors(path: string, tutors: unknown[]) {
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      const { pathname } = new URL(String(input), "http://localhost");
      if (pathname === path) return json({ tutors });
      return json({ error: "unexpected" }, 500);
    });
  }

  it("shows the institute, distance and areas on nearby cards", async () => {
    mockTutors("/api/v1/tutors/nearby", NEARBY);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Nusrat Jahan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("University of Dhaka")).toBeInTheDocument();
    expect(
      screen.getByText("Dhanmondi, Banani", { exact: false }).closest("p"),
    ).toHaveTextContent("Dhanmondi, Banani · 2.5 km away");
    expect(screen.getByRole("list", { name: "Subjects" })).toHaveTextContent(
      "Physics",
    );
  });

  it("shows the institute and areas without a distance in search results", async () => {
    mockTutors("/api/v1/tutors", SEARCH);
    const user = userEvent.setup();

    renderPage();
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByRole("heading", { name: "Rafi Ahmed" }),
    ).toBeInTheDocument();
    const card = screen
      .getByRole("heading", { name: "Rafi Ahmed" })
      .closest("li")!;
    expect(within(card).getByText("BUET")).toBeInTheDocument();
    expect(
      within(card).getByText("Banani", { exact: false }).closest("p"),
    ).toHaveTextContent(/^Banani$/);
    expect(screen.queryByText(/away/)).not.toBeInTheDocument();
  });
});

describe("PackageCard", () => {
  it("shows the status and a View link when the student already applied", async () => {
    mockPackages([]);
    const card = pkg({
      closed: true,
      myApplication: { id: "app-9", status: "PENDING" },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ul>
          <PackageCard pkg={card} />
        </ul>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View/ })).toHaveAttribute(
      "href",
      "/dashboard/applications/app-9",
    );
    expect(screen.queryByText("Application closed")).not.toBeInTheDocument();
  });
});
