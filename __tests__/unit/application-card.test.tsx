import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationCard } from "@/components/applications/application-card";
import { apiFetch } from "@/lib/api";
import type { Application, ApplicationTarget } from "@/lib/applications";

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

vi.mock("@/lib/subjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subjects")>()),
  useSubjects: () => ({ subjects: SUBJECT_OPTIONS }),
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
      levels: [{ code: 9, label: "Class 9" }],
      groups: [],
    },
  ],
  admissionTargets: [],
  retakerLabels: [],
};

const PACKAGE_TARGET: ApplicationTarget = {
  kind: "PACKAGE",
  id: "pkg-1",
  status: "OPEN",
  closed: false,
  areaId: null,
  subjectIds: [5],
  curriculum: null,
  levelCode: null,
  academicGroup: null,
  salary: null,
  daysPerWeek: 3,
  timeOfDay: "16:00",
  title: "SSC Physics crash course",
  price: 15000,
  durationWeeks: 12,
};

const REQUIREMENT_TARGET: ApplicationTarget = {
  kind: "REQUIREMENT",
  id: "req-1",
  status: "OPEN",
  closed: false,
  areaId: 2,
  subjectIds: [2],
  curriculum: "BANGLA_MEDIUM",
  levelCode: 9,
  academicGroup: null,
  salary: 5000,
  daysPerWeek: 3,
  timeOfDay: "16:00",
  title: null,
  price: null,
  durationWeeks: null,
};

function application(
  target: ApplicationTarget,
  overrides: Partial<Application> = {},
): Application {
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
      gender: "MALE",
      instituteName: "University of Dhaka",
      ratingAvg: 4.5,
      ratingCount: 12,
    },
    student: { id: "s1", name: "Nadia Islam", areaId: 1 },
    target,
    allowedActions: [],
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderCard(app: Application, role: "TUTOR" | "STUDENT") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationCard application={app} role={role} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation(async (input: string) => {
    const { pathname } = new URL(String(input), "http://localhost");
    if (pathname === "/api/v1/lookups/education") return json(LOOKUP);
    return json({ error: "unexpected" }, 500);
  });
});

describe("ApplicationCard for a package", () => {
  it("headlines the package title and names the tutor beneath it", () => {
    renderCard(application(PACKAGE_TARGET), "STUDENT");

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "SSC Physics crash course",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Rafiq Ahmed")).toBeInTheDocument();
  });

  it("shows the total price, duration and schedule instead of a monthly salary", () => {
    renderCard(application(PACKAGE_TARGET), "STUDENT");
    const article = screen.getByRole("article");

    expect(article).toHaveTextContent(
      "৳15,000 total · 12 weeks · 3 days a week · ",
    );
    expect(article).not.toHaveTextContent("a month");
  });

  it("skips the area and level lines, which packages do not carry", () => {
    renderCard(application(PACKAGE_TARGET), "STUDENT");
    const article = screen.getByRole("article");

    expect(within(article).getByText("Physics")).toBeInTheDocument();
    expect(within(article).queryByText("Online")).not.toBeInTheDocument();
  });

  it("headlines the student's name for a tutor viewing a package request", () => {
    renderCard(application(PACKAGE_TARGET), "TUTOR");

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "SSC Physics crash course",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nadia Islam")).toBeInTheDocument();
  });
});

describe("ApplicationCard for a requirement", () => {
  it("keeps the counterpart's name as the heading and the monthly salary", () => {
    renderCard(application(REQUIREMENT_TARGET), "STUDENT");

    expect(
      screen.getByRole("heading", { level: 2, name: "Rafiq Ahmed" }),
    ).toBeInTheDocument();
    const article = screen.getByRole("article");
    expect(article).toHaveTextContent("৳5,000 a month");
    expect(article).not.toHaveTextContent("total");
  });
});
