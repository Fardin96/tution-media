import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MatchingPage } from "@/components/admin/matching-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type { MatchingConfigValue } from "@/lib/admin-matching";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/matching",
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  useAdminMe: vi.fn(),
}));

const CONFIG_PATH = "/api/v1/admin/matching/config";
const PREVIEW_PATH = "/api/v1/admin/matching/preview";
const UNMATCHED_PATH = "/api/v1/admin/matching/unmatched";
const EXPLAIN_PATH = "/api/v1/admin/matching/explain";
const CITIES_PATH = "/api/v1/admin/cities";
const DISTRICTS_PATH = "/api/v1/admin/areas";

const REQUIREMENT_ID = "11111111-1111-4111-8111-111111111111";
const TUTOR_ID = "22222222-2222-4222-8222-222222222222";

const SAVED: MatchingConfigValue = {
  version: 4,
  rules: {
    curriculum: { mode: "REQUIRED", weight: 3 },
    level: { mode: "REQUIRED", weight: 3, slack: 0 },
    subject: { mode: "REQUIRED", weight: 3, requireAll: false },
    groupTarget: { mode: "REQUIRED", weight: 1 },
    location: { mode: "RANK", weight: 3 },
    gender: { mode: "REQUIRED", weight: 1 },
    salary: { mode: "RANK", weight: 2 },
    schedule: { mode: "RANK", weight: 2 },
    capacity: { mode: "RANK", weight: 1 },
    quality: { mode: "RANK", weight: 2 },
    recency: { mode: "RANK", weight: 1 },
  },
  cityEdgeKm: 2,
  outsideCityKm: 2,
  distanceScoreKm: 10,
  admissionIgnoresCurriculum: true,
  curriculumEquivalents: [],
};

const RULE_MODES = {
  curriculum: ["REQUIRED", "RANK"],
  level: ["REQUIRED", "RANK"],
  subject: ["REQUIRED", "RANK"],
  groupTarget: ["REQUIRED", "RANK", "OFF"],
  location: ["REQUIRED", "RANK"],
  gender: ["REQUIRED", "RANK", "OFF"],
  salary: ["REQUIRED", "RANK", "OFF"],
  schedule: ["REQUIRED", "RANK", "OFF"],
  capacity: ["REQUIRED", "RANK", "OFF"],
  quality: ["RANK", "OFF"],
  recency: ["RANK", "OFF"],
};

const RULE_NAMES = [
  "Curriculum",
  "Class",
  "Subjects",
  "Group and admission target",
  "Teaching zone",
  "Tutor gender",
  "Salary",
  "Days and time",
  "Seats and start date",
  "Rating and verification",
  "Newer tuitions first",
];

function record(config: MatchingConfigValue = SAVED) {
  return {
    config,
    defaults: { ...SAVED, version: 0 },
    ruleModes: RULE_MODES,
    updatedAt: "2026-11-18T10:00:00.000Z",
    updatedByName: "Farabi",
  };
}

function preview() {
  const side = (openRequirements: number, tutorsWithAMatch: number) => ({
    version: 4,
    openRequirements,
    requirementsWithNoTutor: 5,
    requirementsWithFewTutors: 7,
    requirementsWithManyTutors: 9,
    listedTutors: 40,
    tutorsWithAMatch,
    blockers: [{ rule: "gender" as const, requirements: 6 }],
  });
  return { current: side(21, 12), draft: side(21, 3) };
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Routes the matching API. `handlers` overrides a path+method with a custom response. */
function mockApi(
  overrides: Record<string, (init?: RequestInit) => Response> = {},
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    const method = init?.method ?? "GET";
    const key = `${method} ${pathname}`;
    if (overrides[key]) return overrides[key](init);
    if (key === `GET ${CONFIG_PATH}`) return respond(record());
    if (key === `POST ${PREVIEW_PATH}`) return respond(preview());
    if (key === `PUT ${CONFIG_PATH}`) return respond(record());
    if (key === `GET ${UNMATCHED_PATH}`) {
      return respond({
        requirements: [
          {
            id: REQUIREMENT_ID,
            createdAt: "2026-11-17T12:00:00.000Z",
            studentName: "Nafis",
            curriculum: null,
            levelCode: null,
            subjectIds: [],
            areaId: null,
            tuitionType: "Home Tutoring Solo",
            blockers: ["reach", "gender"],
          },
        ],
      });
    }
    if (key === `GET ${CITIES_PATH}`) {
      return respond({
        cities: [
          {
            slug: "dhaka",
            name: "Dhaka",
            districtCode: "dhaka",
            isActive: true,
            areaKm2: 1463.7,
            updatedAt: "2026-11-01T00:00:00.000Z",
          },
        ],
      });
    }
    if (key === `GET ${DISTRICTS_PATH}`) {
      return respond({
        areas: [],
        districts: [
          { code: "dhaka", name: "Dhaka", division: "Dhaka" },
          { code: "sylhet", name: "Sylhet", division: "Sylhet" },
        ],
      });
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function asAdmin(isSuperAdmin: boolean) {
  vi.mocked(useAdminMe).mockReturnValue({
    isSuperAdmin,
    isSuccess: true,
  } as unknown as ReturnType<typeof useAdminMe>);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MatchingPage />
    </QueryClientProvider>,
  );
}

function sectionOf(heading: string) {
  const section = screen
    .getByRole("heading", { name: heading })
    .closest("section");
  if (!section) throw new Error(`${heading} section not found`);
  return section;
}

function callsTo(key: string) {
  return vi.mocked(apiFetch).mock.calls.filter(([input, init]) => {
    const { pathname } = new URL(input, "http://localhost");
    return `${init?.method ?? "GET"} ${pathname}` === key;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  asAdmin(true);
  mockApi();
});

describe("MatchingPage rules tab", () => {
  it("renders every rule in order under the saved version line", async () => {
    renderPage();

    expect(
      await screen.findByText(
        "Version 4 · Saved by Farabi on 18 Nov 2026, 16:00",
      ),
    ).toBeInTheDocument();

    const modes = within(sectionOf("Rules"))
      .getAllByRole("group")
      .map((group) => group.getAttribute("aria-label"));
    expect(modes).toEqual(RULE_NAMES.map((name) => `${name} mode`));
  });

  it("shows the fixed city limit note and the level and subject extras", async () => {
    renderPage();
    await screen.findByText(/City limit: home tuition always needs/);

    const rules = sectionOf("Rules");
    expect(
      within(rules).getByRole("combobox", { name: "Class slack" }),
    ).toBeInTheDocument();
    expect(
      within(rules).getByRole("switch", { name: "Require every subject" }),
    ).toBeInTheDocument();
  });

  it("uses the default-rules line when nothing was saved yet", async () => {
    mockApi({
      [`GET ${CONFIG_PATH}`]: () =>
        respond({ ...record(), updatedAt: null, updatedByName: null }),
    });
    renderPage();

    expect(
      await screen.findByText("Using the default rules"),
    ).toBeInTheDocument();
  });

  it("shows the save bar with one unsaved change after a mode switch", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Version 4/);

    const subjects = within(sectionOf("Rules")).getByRole("group", {
      name: "Subjects mode",
    });
    await user.click(
      within(subjects).getByRole("button", { name: "Ranks higher" }),
    );

    expect(await screen.findByText("1 unsaved change")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeEnabled();
  });

  it("puts the draft back on Discard", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Version 4/);

    const subjects = within(sectionOf("Rules")).getByRole("group", {
      name: "Subjects mode",
    });
    await user.click(
      within(subjects).getByRole("button", { name: "Ranks higher" }),
    );
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    expect(screen.queryByText("1 unsaved change")).not.toBeInTheDocument();
    // Discard remounts the form, so the group is looked up again.
    const reset = within(sectionOf("Rules")).getByRole("group", {
      name: "Subjects mode",
    });
    expect(
      within(reset).getByRole("button", { name: "Required" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("saves the draft without the version", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Version 4/);

    const subjects = within(sectionOf("Rules")).getByRole("group", {
      name: "Subjects mode",
    });
    await user.click(
      within(subjects).getByRole("button", { name: "Ranks higher" }),
    );
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(`PUT ${CONFIG_PATH}`)).toHaveLength(1));
    const [, init] = callsTo(`PUT ${CONFIG_PATH}`)[0];
    const body = JSON.parse(String(init?.body));
    expect(body).not.toHaveProperty("version");
    expect(body.rules.subject.mode).toBe("RANK");
  });

  it("disables the controls and offers only Preview for a plain admin", async () => {
    asAdmin(false);
    renderPage();
    await screen.findByText(/Version 4/);

    expect(
      screen.getByText("Only a super admin can change matching rules."),
    ).toBeInTheDocument();
    const subjects = within(sectionOf("Rules")).getByRole("group", {
      name: "Subjects mode",
    });
    for (const button of within(subjects).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeEnabled();
  });

  it("renders the preview counts for now and with the changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Version 4/);

    const subjects = within(sectionOf("Rules")).getByRole("group", {
      name: "Subjects mode",
    });
    await user.click(
      within(subjects).getByRole("button", { name: "Ranks higher" }),
    );
    await user.click(await screen.findByRole("button", { name: "Preview" }));

    const table = await screen.findByRole("table");
    const openRow = within(table).getByRole("row", { name: /Open tuitions/ });
    expect(within(openRow).getAllByRole("cell")[0]).toHaveTextContent("21");
    const matchRow = within(table).getByRole("row", {
      name: /Tutors with a match/,
    });
    expect(within(matchRow).getByText("12 of 40")).toBeInTheDocument();
    expect(within(matchRow).getByText("3 of 40")).toBeInTheDocument();

    const blockers = sectionOf("Preview");
    expect(within(blockers).getByText("Tutor gender")).toBeInTheDocument();
    expect(within(blockers).getByText("6 tuitions")).toBeInTheDocument();
  });

  it("shows the server's field issue next to the field on a 400", async () => {
    const user = userEvent.setup();
    mockApi({
      [`PUT ${CONFIG_PATH}`]: () =>
        respond(
          {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            issues: [
              {
                path: ["body", "rules", "subject", "mode"],
                message: "subject cannot be OFF",
              },
            ],
          },
          400,
        ),
    });
    renderPage();
    await screen.findByText(/Version 4/);

    const subjects = within(sectionOf("Rules")).getByRole("group", {
      name: "Subjects mode",
    });
    await user.click(
      within(subjects).getByRole("button", { name: "Ranks higher" }),
    );
    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("subject cannot be OFF"),
    ).toBeInTheDocument();
  });
});

describe("MatchingPage tabs", () => {
  it("shows the unmatched tuitions with their blockers", async () => {
    nav.search = "tab=unmatched";
    renderPage();

    expect(await screen.findByText("Nafis")).toBeInTheDocument();
    expect(
      screen.getByText("Would match without: City limit, Tutor gender"),
    ).toBeInTheDocument();
    expect(callsTo(`GET ${UNMATCHED_PATH}`)[0][0]).toMatch(/olderThanHours=24/);
  });

  it("shows the explain 404 as a plain message", async () => {
    const user = userEvent.setup();
    nav.search = "tab=explain";
    mockApi({
      [`GET ${EXPLAIN_PATH}`]: () =>
        respond({ code: "NOT_FOUND", message: "Not found" }, 404),
    });
    renderPage();

    await user.type(screen.getByLabelText("Tuition ID"), REQUIREMENT_ID);
    await user.type(screen.getByLabelText("Tutor ID"), TUTOR_ID);
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(
      await screen.findByText("No tuition or tutor with that ID."),
    ).toBeInTheDocument();
  });

  it("asks for valid IDs before it checks a pair", async () => {
    const user = userEvent.setup();
    nav.search = "tab=explain";
    renderPage();

    await user.type(screen.getByLabelText("Tuition ID"), "nope");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(
      await screen.findByText("Enter a valid tuition ID."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid tutor ID.")).toBeInTheDocument();
    expect(callsTo(`GET ${EXPLAIN_PATH}`)).toHaveLength(0);
  });

  it("lists cities with the district name and the area", async () => {
    nav.search = "tab=cities";
    renderPage();

    expect(await screen.findByText(/1,464 km²/)).toBeInTheDocument();
    // The district select repeats the name, so the row's name is the one inside the list item.
    expect(
      within(screen.getByRole("listitem")).getByText("Dhaka"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Add or replace a city" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Boundaries from OpenStreetMap need the credit © OpenStreetMap contributors.",
      ),
    ).toBeInTheDocument();
  });

  it("hides the city form and switches from a plain admin", async () => {
    asAdmin(false);
    nav.search = "tab=cities";
    renderPage();

    expect(await screen.findByText("Dhaka")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Add or replace a city" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
