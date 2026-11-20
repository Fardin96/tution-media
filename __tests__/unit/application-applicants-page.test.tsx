import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequirementApplicantsPage } from "@/components/applications/requirement-applicants-page";
import { apiFetch } from "@/lib/api";
import type { Application } from "@/lib/applications";

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

const REQUIREMENT_ID = "req-1";

function application(
  overrides: Partial<Application["tutor"]> = {},
): Application {
  return {
    id: "app-1",
    initiatedBy: "TUTOR",
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
      ...overrides,
    },
    student: { id: "s1", name: "Nadia Islam", areaId: 1 },
    target: {
      kind: "REQUIREMENT",
      id: REQUIREMENT_ID,
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
    allowedActions: ["confirm", "reject"],
  };
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockApplicants(applications: Application[]) {
  vi.mocked(apiFetch).mockImplementation(async (input) => {
    const { pathname } = new URL(input, "http://localhost");
    if (pathname === `/api/v1/requirements/${REQUIREMENT_ID}/applications`) {
      return respond({ applications, nextCursor: null });
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
      <RequirementApplicantsPage requirementId={REQUIREMENT_ID} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RequirementApplicantsPage", () => {
  it("shows the tutor's institute and a link to the application", async () => {
    mockApplicants([application()]);
    renderPage();

    const card = (
      await screen.findByRole("heading", { name: "Rafiq Ahmed" })
    ).closest("article");
    if (!card) throw new Error("applicant card not rendered");

    expect(within(card).getByText("University of Dhaka")).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: "View tutor" }),
    ).toHaveAttribute("href", "/dashboard/applications/app-1?from=applicants");
    expect(
      within(card).getByRole("button", { name: "Accept" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Decline" }),
    ).toBeInTheDocument();
  });

  it("links the tutor's name to their profile page", async () => {
    mockApplicants([application()]);
    renderPage();

    const heading = await screen.findByRole("heading", { name: "Rafiq Ahmed" });
    expect(
      within(heading).getByRole("link", { name: "Rafiq Ahmed" }),
    ).toHaveAttribute("href", "/tutors/t1");
  });

  it("links back to the dashboard with one back control", async () => {
    mockApplicants([]);
    renderPage();

    expect(
      await screen.findByText("No tutors have applied to this tuition yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(
      screen.queryByRole("link", { name: "Back to dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("leaves out the institute line when the tutor has none", async () => {
    mockApplicants([application({ instituteName: null })]);
    renderPage();

    await screen.findByRole("heading", { name: "Rafiq Ahmed" });
    expect(screen.queryByText("University of Dhaka")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View tutor" }),
    ).toBeInTheDocument();
  });
});
