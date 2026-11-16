import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { FindTuitionsPage } from "@/components/browse/find-tuitions-page";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const replace = vi.fn();
const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard/find-tuitions",
  useSearchParams: () => searchParams,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const LOOKUP = {
  version: 1,
  levelRange: { min: 0, max: 12 },
  groupLevels: { min: 11, max: 12 },
  admissionLevel: 99,
  levelNoteMaxLength: 200,
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

function requirement(overrides: Record<string, unknown> & { id: string }) {
  return {
    areaId: 1,
    subjectIds: [3, 6],
    curriculum: "BANGLA_MEDIUM",
    levelCode: 9,
    academicGroup: null,
    admissionTargets: [],
    isRetaker: false,
    levelNote: null,
    timeOfDay: "18:00",
    daysPerWeek: 3,
    availableDays: 5,
    salary: 25000,
    studentCount: 1,
    hireByDate: "2026-12-01",
    tutorGenderPref: "ANY",
    tuitionType: null,
    createdAt: "2026-11-10T06:00:00.000Z",
    distanceKm: 2.5,
    closed: false,
    myApplication: null,
    ...overrides,
  };
}

const OPEN = requirement({ id: "req-open" });
const CLOSED = requirement({ id: "req-closed", closed: true, subjectIds: [1] });

type Readiness = {
  ready: boolean;
  missing: string[];
  verificationRequired: boolean;
};

const DEFAULT_SET = {
  id: "set-default",
  name: "Main set",
  isDefault: true,
  isActive: true,
};
const OTHER_SET = {
  id: "set-weekend",
  name: "Weekend",
  isDefault: false,
  isActive: true,
};

function mockApi(
  opts: { readiness?: Readiness; rows?: unknown[]; sets?: unknown[] } = {},
) {
  const readiness = opts.readiness ?? {
    ready: true,
    missing: [],
    verificationRequired: false,
  };
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    if (
      method === "POST" &&
      /\/api\/v1\/requirements\/[^/]+\/applications$/.test(url.pathname)
    ) {
      return json(201, { id: "app-new", status: "PENDING" });
    }
    if (url.pathname === "/api/v1/lookups/education") return json(200, LOOKUP);
    if (url.pathname === "/api/v1/me") {
      return json(200, { account: { id: "acc-1", applyReadiness: readiness } });
    }
    if (url.pathname === "/api/v1/requirements") {
      return json(200, {
        requirements: opts.rows ?? [OPEN, CLOSED],
        nextCursor: null,
        noServiceArea: false,
      });
    }
    if (url.pathname === "/api/v1/tutors/me/requirements") {
      return json(200, { requirements: opts.sets ?? [] });
    }
    return json(404, { error: "NotFound", message: "not mocked" });
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FindTuitionsPage />
    </QueryClientProvider>,
  );
}

describe("FindTuitionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replace.mockClear();
    for (const key of [...searchParams.keys()]) searchParams.delete(key);
  });

  function browseRequests() {
    return vi
      .mocked(apiFetch)
      .mock.calls.map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname === "/api/v1/requirements");
  }

  it("renders cards from the browse page with their facts", async () => {
    mockApi();
    renderPage();

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(
      first.getByRole("heading", { name: "Mathematics · Chemistry" }),
    ).toBeInTheDocument();
    expect(first.getByText("Dhanmondi")).toBeInTheDocument();
    expect(first.getByText("৳25,000 a month")).toBeInTheDocument();
    expect(first.getByText("3 days a week")).toBeInTheDocument();
    expect(first.getByText("2.5 km away")).toBeInTheDocument();
    expect(first.getByText(/Hire by Dec 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText("2 tuitions")).toBeInTheDocument();
  });

  it("shows Application closed and no Apply button on a closed card", async () => {
    mockApi();
    renderPage();

    const cards = await screen.findAllByRole("article");
    const closed = within(cards[1]);
    expect(closed.getByText("Application closed")).toBeInTheDocument();
    expect(closed.queryByRole("button", { name: /apply/i })).toBeNull();
  });

  it("sends the application on Apply and confirms with a toast", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();

    const cards = await screen.findAllByRole("article");
    await user.click(within(cards[0]).getByRole("button", { name: /^apply/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Application sent."),
    );
    const post = vi
      .mocked(apiFetch)
      .mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    expect(new URL(String(post![0])).pathname).toBe(
      "/api/v1/requirements/req-open/applications",
    );
  });

  it("disables Apply and explains why when the profile is not ready", async () => {
    mockApi({
      readiness: {
        ready: false,
        missing: ["PHONE_NUMBER_MISSING"],
        verificationRequired: false,
      },
    });
    renderPage();

    const cards = await screen.findAllByRole("article");
    const apply = within(cards[0]).getByRole("button", { name: /^apply/i });
    expect(apply).toBeDisabled();
    expect(
      within(cards[0]).getByText("Finish your profile to apply."),
    ).toBeInTheDocument();
  });

  it("shows three scope segments", async () => {
    mockApi();
    renderPage();

    const scope = screen.getByRole("group", { name: "Scope" });
    expect(
      within(scope)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Near me", "All open", "My sets"]);
    await screen.findAllByRole("article");
  });

  it("hides the manual filters and preselects the default set in set mode", async () => {
    searchParams.set("scope", "set");
    mockApi({ sets: [OTHER_SET, DEFAULT_SET] });
    renderPage();

    const select = await screen.findByLabelText("Requirement set");
    expect(select).toHaveValue("set-default");
    expect(
      screen.getByRole("option", { name: "Main set (default)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Weekend" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Curriculum")).toBeNull();
    expect(screen.queryByLabelText("Class")).toBeNull();
    expect(screen.queryByLabelText("Subject")).toBeNull();
    expect(screen.queryByLabelText("Area")).toBeNull();

    // The chosen set goes into the URL so the page can be shared.
    expect(replace).toHaveBeenCalledWith(
      "/dashboard/find-tuitions?scope=set&set=set-default",
      { scroll: false },
    );
  });

  it("sends setId and no manual filters in set mode", async () => {
    searchParams.set("scope", "set");
    searchParams.set("set", "set-weekend");
    searchParams.set("subjectId", "3");
    mockApi({ sets: [DEFAULT_SET, OTHER_SET] });
    renderPage();

    await screen.findAllByRole("article");
    const requests = browseRequests();
    expect(requests.length).toBeGreaterThan(0);
    const query = requests[0].searchParams;
    expect(query.get("scope")).toBe("set");
    expect(query.get("setId")).toBe("set-weekend");
    expect(query.has("subjectId")).toBe(false);
    expect(query.has("curriculum")).toBe(false);
    expect(query.has("levelCode")).toBe(false);
    expect(query.has("areaId")).toBe(false);
  });

  it("falls back to the default set when the URL set is not active", async () => {
    searchParams.set("scope", "set");
    searchParams.set("set", "set-archived");
    mockApi({ sets: [DEFAULT_SET, OTHER_SET] });
    renderPage();

    await screen.findAllByRole("article");
    expect(replace).toHaveBeenCalledWith(
      "/dashboard/find-tuitions?scope=set&set=set-default",
      { scroll: false },
    );
    expect(browseRequests()[0].searchParams.get("setId")).toBe("set-default");
  });

  it("waits for a set before browsing when no default exists", async () => {
    searchParams.set("scope", "set");
    mockApi({ sets: [OTHER_SET] });
    renderPage();

    const select = await screen.findByLabelText("Requirement set");
    expect(select).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Choose a set" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose a set to see matching tuitions."),
    ).toBeInTheDocument();
    expect(browseRequests()).toHaveLength(0);
  });

  it("links to create a set when the tutor has no active sets", async () => {
    searchParams.set("scope", "set");
    mockApi({ sets: [] });
    renderPage();

    expect(
      await screen.findByText("You have no requirement sets yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a set" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/requirements/new",
    );
    expect(screen.queryByLabelText("Requirement set")).toBeNull();
    expect(browseRequests()).toHaveLength(0);
  });
});
