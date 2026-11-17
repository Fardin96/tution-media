import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationDetailPage } from "@/components/applications/application-detail-page";
import { apiFetch } from "@/lib/api";
import { formatTimeRange } from "@/lib/tutor-requirements";
import type { ApplicationDetail } from "@/lib/applications";

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

const APP_ID = "app-1";

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
        { code: 0, label: "Pre-school" },
        { code: 9, label: "Class 9" },
      ],
      groups: [],
    },
    {
      code: "ENGLISH_VERSION",
      label: "English version",
      levels: [{ code: 9, label: "Class 9" }],
      groups: [],
    },
  ],
  admissionTargets: [],
  retakerLabels: [],
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function detail(overrides: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    id: APP_ID,
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
    target: {
      kind: "REQUIREMENT",
      id: "r1",
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
    },
    allowedActions: [],
    counterpartContact: null,
    fee: null,
    tutorProfile: {
      id: "t1",
      name: "Rafiq Ahmed",
      gender: "MALE",
      instituteName: "University of Dhaka",
      ratingAvg: 4.5,
      ratingCount: 12,
      verificationStatus: "APPROVED",
      areas: [
        { id: 2, name: "Dhanmondi" },
        { id: 5, name: "Banani" },
      ],
      subjects: [{ id: 2, name: "English" }],
      credentials: [{ id: "c1", examLabel: "HSC", result: "GPA 5.00" }],
    },
    tutorSet: {
      matchedBy: "MATCH",
      set: {
        id: "set-1",
        name: "Evening batch",
        isDefault: true,
        levelMin: 0,
        levelMax: 9,
        curricula: ["BANGLA_MEDIUM"],
        academicGroups: [],
        admissionTargets: [],
        subjectIds: [2, 3],
        timeFrom: "16:00",
        timeTo: "18:00",
        availableDays: 5,
        daysPerWeek: 2,
        minSalary: 5000,
        maxStudents: 3,
        teachesOnline: true,
      },
    },
    ...overrides,
  };
}

function packageTarget(): ApplicationDetail["target"] {
  return {
    kind: "PACKAGE",
    id: "p1",
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
}

function mockDetail(body: ApplicationDetail) {
  vi.mocked(apiFetch).mockImplementation(async (input) => {
    const { pathname } = new URL(input, "http://localhost");
    if (pathname === "/api/v1/lookups/education") return respond(LOOKUP);
    if (pathname === `/api/v1/applications/${APP_ID}`) return respond(body);
    return respond({ message: "Not mocked" }, 404);
  });
}

function renderPage(
  role: "TUTOR" | "STUDENT",
  from?: "applicants" | "package-requests",
  packageId?: string,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationDetailPage
        id={APP_ID}
        role={role}
        from={from}
        packageId={packageId}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApplicationDetailPage for a student", () => {
  it("shows the tutor and the set they teach from", async () => {
    mockDetail(detail());
    renderPage("STUDENT");

    const tutor = await screen.findByRole("region", { name: "Tutor" });
    expect(within(tutor).getByText("Rafiq Ahmed")).toBeInTheDocument();
    expect(within(tutor).getByText("University of Dhaka")).toBeInTheDocument();
    expect(within(tutor).getByText("Verified")).toBeInTheDocument();
    expect(within(tutor).getByText("4.5")).toBeInTheDocument();
    expect(within(tutor).getByText("English")).toBeInTheDocument();
    expect(within(tutor).getByText("Dhanmondi, Banani")).toBeInTheDocument();
    expect(within(tutor).getByText("HSC — GPA 5.00")).toBeInTheDocument();

    const set = screen.getByRole("region", { name: "Their teaching set" });
    expect(within(set).getByText("Evening batch")).toBeInTheDocument();
    expect(within(set).getByText("Pre-school to Class 9")).toBeInTheDocument();
    expect(within(set).getByText("Bangla medium")).toBeInTheDocument();
    expect(within(set).getByText("English · Mathematics")).toBeInTheDocument();
    expect(
      within(set).getByText(formatTimeRange("16:00", "18:00")),
    ).toBeInTheDocument();
    expect(
      within(set).getByText("2 days a week · Sat, Mon"),
    ).toBeInTheDocument();
    expect(within(set).getByText("৳5,000 a month")).toBeInTheDocument();
    expect(within(set).getByText("3 students")).toBeInTheDocument();
    expect(within(set).getByText("Teaches online")).toBeInTheDocument();
    expect(
      within(set).queryByText(/None of this tutor/),
    ).not.toBeInTheDocument();
  });

  it("shows the default note when the tutor has no set that matches", async () => {
    mockDetail(
      detail({
        tutorSet: { ...detail().tutorSet!, matchedBy: "DEFAULT" },
      }),
    );
    renderPage("STUDENT");

    const set = await screen.findByRole("region", {
      name: "Their teaching set",
    });
    expect(
      within(set).getByText(
        "None of this tutor's sets match your requirement exactly. This is their default set.",
      ),
    ).toBeInTheDocument();
  });

  it("omits the set section for a package, which has no tutor set", async () => {
    mockDetail(
      detail({
        target: packageTarget(),
        tutorSet: null,
      }),
    );
    renderPage("STUDENT");

    expect(
      await screen.findByRole("region", { name: "Tutor" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Their teaching set" }),
    ).not.toBeInTheDocument();
  });

  it("omits the set section when the tutor has no set", async () => {
    mockDetail(detail({ tutorSet: null }));
    renderPage("STUDENT");

    expect(
      await screen.findByRole("region", { name: "Tutor" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Their teaching set" }),
    ).not.toBeInTheDocument();
  });
});

describe("ApplicationDetailPage for a package", () => {
  it("titles the page with the package and shows the total price and duration", async () => {
    mockDetail(detail({ target: packageTarget() }));
    renderPage("STUDENT");

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "SSC Physics crash course",
    });
    expect(heading.parentElement).toHaveTextContent("Rafiq Ahmed");

    const tuition = screen.getByRole("region", { name: "Tuition" });
    expect(within(tuition).getByText("Price")).toBeInTheDocument();
    expect(within(tuition).getByText("৳15,000 total")).toBeInTheDocument();
    expect(within(tuition).getByText("12 weeks")).toBeInTheDocument();
    expect(within(tuition).getByText("Physics")).toBeInTheDocument();
    expect(within(tuition).queryByText("Area")).not.toBeInTheDocument();
    expect(within(tuition).queryByText("Salary")).not.toBeInTheDocument();
  });
});

describe("ApplicationDetailPage back link", () => {
  it("returns to the applications list by default", async () => {
    mockDetail(detail());
    renderPage("STUDENT");

    expect(
      await screen.findByRole("link", { name: "Applications" }),
    ).toHaveAttribute("href", "/dashboard/applications");
  });

  it("returns to the requirement's applicants when opened from there", async () => {
    mockDetail(detail());
    renderPage("STUDENT", "applicants");

    expect(
      await screen.findByRole("link", { name: "Applicants" }),
    ).toHaveAttribute("href", "/dashboard/requirements/r1/applicants");
    expect(
      screen.queryByRole("link", { name: "Applications" }),
    ).not.toBeInTheDocument();
  });

  it("returns to the package's requests when opened from there", async () => {
    mockDetail(
      detail({
        target: { ...detail().target, kind: "PACKAGE", id: "p1" },
      }),
    );
    renderPage("TUTOR", "package-requests", "p1");

    const back = await screen.findByRole("link", { name: "Requests" });
    expect(back).toHaveAttribute(
      "href",
      "/dashboard/tutor/packages/p1/requests",
    );
    expect(
      screen.queryByRole("link", { name: "Applications" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to applications when the target is a package", async () => {
    mockDetail(
      detail({
        target: { ...detail().target, kind: "PACKAGE", id: "p1" },
      }),
    );
    renderPage("STUDENT", "applicants");

    expect(
      await screen.findByRole("link", { name: "Applications" }),
    ).toHaveAttribute("href", "/dashboard/applications");
  });
});

describe("ApplicationDetailPage for a tutor", () => {
  it("shows neither the tutor nor the set sections", async () => {
    mockDetail(detail({ tutorProfile: null, tutorSet: null }));
    renderPage("TUTOR");

    expect(
      await screen.findByRole("heading", { name: "Tuition" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Tutor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Their teaching set" }),
    ).not.toBeInTheDocument();
  });
});
