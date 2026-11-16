import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    subjectId: 3,
    areaId: null,
    curriculum: "BANGLA_MEDIUM",
    levelCode: 9,
    academicGroup: null,
    admissionTargets: [],
    isRetaker: false,
    levelNote: null,
    timeOfDay: "16:00",
    daysPerWeek: 3,
    expectedSalary: 5000,
    studentCount: 2,
    availableFrom: "2026-12-01",
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

    expect(await screen.findByText("No packages yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tutors will be able to publish fixed packages soon. Meanwhile, browse tutors or post a requirement.",
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
