import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PackageRequestsPage } from "@/components/packages/package-requests-page";
import { apiFetch } from "@/lib/api";
import type { Application } from "@/lib/applications";
import type { MyPackage } from "@/lib/packages";

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

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const PACKAGE_ID = "pkg-1";

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

function pkg(overrides: Partial<MyPackage> = {}): MyPackage {
  return {
    id: PACKAGE_ID,
    tutor: {
      id: "t1",
      name: "Rafiq Ahmed",
      avatarUrl: null,
      gender: "MALE",
      ratingAvg: 4.5,
      ratingCount: 12,
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
    maxStudents: 1,
    availableFrom: "2026-11-20",
    teachesOnline: true,
    zoneCount: 0,
    status: "OPEN",
    moderationStatus: "APPROVED",
    createdAt: "2026-11-10T04:00:00.000Z",
    closed: false,
    myApplication: null,
    zoneIds: [],
    moderationNote: null,
    updatedAt: "2026-11-10T04:00:00.000Z",
    pendingRequestCount: 1,
    requestCount: 1,
    ...overrides,
  };
}

function request(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    initiatedBy: "STUDENT",
    status: "PENDING",
    appliedAt: "2026-11-10T04:00:00.000Z",
    confirmedAt: null,
    endedAt: null,
    tutor: {
      id: "t1",
      name: "Rafiq Ahmed",
      avatarUrl: null,
      gender: "MALE",
      instituteName: null,
      ratingAvg: 4.5,
      ratingCount: 12,
      verifiedBadge: false,
    },
    student: {
      id: "s1",
      name: "Nadia Islam",
      avatarUrl: null,
      areaId: 2,
      verifiedBadge: false,
    },
    target: {
      kind: "PACKAGE",
      id: PACKAGE_ID,
      status: "OPEN",
      closed: false,
      areaId: null,
      subjectIds: [3],
      curriculum: "BANGLA_MEDIUM",
      levelCode: 9,
      academicGroup: null,
      salary: null,
      daysPerWeek: 3,
      timeOfDay: "16:00",
      title: "SSC Math Booster",
      price: 15000,
      durationWeeks: 12,
    },
    allowedActions: ["confirm", "reject"],
    ...overrides,
  };
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockPackage(
  requests: { applications: Application[]; nextCursor: string | null }[],
) {
  let page = 0;
  vi.mocked(apiFetch).mockImplementation(async (input) => {
    const url = new URL(input, "http://localhost");
    if (url.pathname === "/api/v1/lookups/education") return respond(LOOKUP);
    if (url.pathname === `/api/v1/packages/${PACKAGE_ID}`) {
      return respond(pkg());
    }
    if (url.pathname === `/api/v1/packages/${PACKAGE_ID}/applications`) {
      const body = requests[Math.min(page, requests.length - 1)];
      page += 1;
      return respond(body);
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PackageRequestsPage packageId={PACKAGE_ID} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PackageRequestsPage", () => {
  it("heads the page with the package title, its level and price", async () => {
    mockPackage([{ applications: [], nextCursor: null }]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "SSC Math Booster" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Class 9 to Class 10 · ৳15,000"),
    ).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows the empty state when no student has asked", async () => {
    mockPackage([{ applications: [], nextCursor: null }]);
    renderPage();

    expect(await screen.findByText("No requests yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Students see this package when they browse packages near them.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("shows Accept and Decline on a pending request", async () => {
    mockPackage([{ applications: [request()], nextCursor: null }]);
    renderPage();

    const card = (
      await screen.findByRole("heading", { name: "Nadia Islam" })
    ).closest("article");
    if (!card) throw new Error("request card not rendered");

    expect(
      within(card).getByRole("button", { name: "Accept" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Decline" }),
    ).toBeInTheDocument();
  });

  it("links each request to the application with its package context", async () => {
    mockPackage([{ applications: [request()], nextCursor: null }]);
    renderPage();

    const card = (
      await screen.findByRole("heading", { name: "Nadia Islam" })
    ).closest("article");
    if (!card) throw new Error("request card not rendered");

    expect(
      within(card).getByRole("link", { name: "View request" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/applications/app-1?from=package-requests&package=${PACKAGE_ID}`,
    );
  });

  it("loads the next page of requests with the returned cursor", async () => {
    mockPackage([
      {
        applications: [request({ id: "app-1" })],
        nextCursor: "cursor-2",
      },
      {
        applications: [
          request({
            id: "app-2",
            student: {
              id: "s2",
              name: "Tanvir Hasan",
              avatarUrl: null,
              areaId: 2,
              verifiedBadge: false,
            },
          }),
        ],
        nextCursor: null,
      },
    ]);
    renderPage();

    await screen.findByRole("heading", { name: "Nadia Islam" });
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(
      await screen.findByRole("heading", { name: "Tanvir Hasan" }),
    ).toBeInTheDocument();

    const cursors = vi
      .mocked(apiFetch)
      .mock.calls.map(([input]) =>
        new URL(input, "http://localhost").searchParams.get("cursor"),
      );
    expect(cursors).toContain("cursor-2");
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });
});
