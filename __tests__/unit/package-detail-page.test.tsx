import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PackageDetailPage } from "@/components/browse/package-detail-page";
import { apiFetch } from "@/lib/api";
import type { TuitionPackage } from "@/lib/browse";
import { formatTimeRange } from "@/lib/tutor-requirements";

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

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const PKG_ID = "pkg-1";

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
      groups: [{ code: "SCIENCE", label: "Science" }],
    },
    {
      code: "ENGLISH_VERSION",
      label: "English version",
      levels: [{ code: 9, label: "Class 9" }],
      groups: [],
    },
  ],
  admissionTargets: [
    { code: "ENGINEERING", label: "Engineering", covers: "BUET and others" },
  ],
  retakerLabels: [],
};

function pkg(overrides: Partial<TuitionPackage> = {}): TuitionPackage {
  return {
    id: PKG_ID,
    tutor: {
      id: "tutor-1",
      name: "Nusrat Jahan",
      gender: "FEMALE",
      ratingAvg: 4.5,
      ratingCount: 12,
    },
    title: "SSC Physics crash course",
    description: "Covers the full HSC physics syllabus, one topic a week.",
    coverage: "PARTIAL",
    durationWeeks: 12,
    price: 15000,
    subjectIds: [5],
    levelMin: 9,
    levelMax: 12,
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
    zoneCount: 2,
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

function mockPackage(body: TuitionPackage) {
  vi.mocked(apiFetch).mockImplementation(async (input: string) => {
    const { pathname } = new URL(String(input), "http://localhost");
    if (pathname === "/api/v1/lookups/education") return json(LOOKUP);
    if (pathname === `/api/v1/packages/${PKG_ID}`) return json(body);
    return json({ error: "unexpected" }, 500);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PackageDetailPage id={PKG_ID} />
    </QueryClientProvider>,
  );
}

/** The value under a label in the package details list. */
async function detailValue(label: string) {
  const details = await screen.findByRole("region", {
    name: "Package details",
  });
  return within(details).getByText(label, { selector: "dt" })
    .nextElementSibling;
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("PackageDetailPage", () => {
  it("uses the package title as the page heading with its description beneath", async () => {
    mockPackage(pkg());
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "SSC Physics crash course",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Covers the full HSC physics syllabus, one topic a week.",
      ),
    ).toBeInTheDocument();
  });

  it("shows coverage, duration and the total price", async () => {
    mockPackage(pkg());
    renderPage();

    expect(await detailValue("Coverage")).toHaveTextContent(
      "Part of the curriculum",
    );
    expect(await detailValue("Duration")).toHaveTextContent("12 weeks");
    expect(await detailValue("Price")).toHaveTextContent(/^৳15,000 total$/);
  });

  it("lists the subjects, classes and the schedule", async () => {
    mockPackage(pkg());
    renderPage();

    expect(await detailValue("Subjects")).toHaveTextContent("Physics");
    expect(await detailValue("Classes")).toHaveTextContent(
      "Class 9 to Class 12 · Bangla medium",
    );
    expect(await detailValue("Schedule")).toHaveTextContent(
      `3 days a week · Sat, Mon · ${formatTimeRange("16:00", "18:00")}`,
    );
  });

  it("shows the student cap and the place without zone counts", async () => {
    mockPackage(pkg({ zoneCount: 3, teachesOnline: true, maxStudents: 4 }));
    renderPage();

    expect(await detailValue("Students")).toHaveTextContent("Up to 4 students");
    expect(await detailValue("Place")).toHaveTextContent("Online or in person");
    expect(
      screen.getByRole("region", { name: "Package details" }),
    ).not.toHaveTextContent(/zone/i);
  });

  it("hides groups and admission targets when the package has none", async () => {
    mockPackage(pkg());
    renderPage();

    await screen.findByRole("region", { name: "Package details" });
    expect(
      screen.queryByText("Groups", { selector: "dt" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Admission targets", { selector: "dt" }),
    ).not.toBeInTheDocument();
  });

  it("shows groups and admission targets with their lookup labels", async () => {
    mockPackage(
      pkg({
        academicGroups: ["SCIENCE"],
        admissionTargets: ["ENGINEERING"],
      }),
    );
    renderPage();

    expect(await detailValue("Groups")).toHaveTextContent("Science");
    expect(await detailValue("Admission targets")).toHaveTextContent(
      "Engineering",
    );
  });

  it("offers a request for an open package", async () => {
    mockPackage(pkg());
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Request this package" }),
    ).toBeEnabled();
  });

  it("says the package is closed and disables the request", async () => {
    mockPackage(pkg({ closed: true }));
    renderPage();

    expect(await screen.findByText("Application closed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request this package" }),
    ).toBeDisabled();
  });
});
