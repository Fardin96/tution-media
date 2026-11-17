import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { MyPackagesPage } from "@/components/packages/my-packages-page";
import { apiFetch } from "@/lib/api";
import type { MyPackage } from "@/lib/packages";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
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
    levelMax: 12,
    curricula: ["BANGLA_MEDIUM"],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 127,
    daysPerWeek: 3,
    maxStudents: 5,
    availableFrom: "2026-11-01",
    teachesOnline: false,
    zoneCount: 1,
    status: "OPEN",
    moderationStatus: "APPROVED",
    createdAt: "2026-11-01T00:00:00Z",
    closed: false,
    myApplication: null,
    zoneIds: ["z1"],
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

/** Serves the list, the lookup and the close endpoint; anything else is a failure. */
function mockApi(packages: MyPackage[]) {
  vi.mocked(apiFetch).mockImplementation(async (input: string, init) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    if (pathname === "/api/v1/packages/mine" && method === "GET") {
      return json({ packages });
    }
    if (pathname === "/api/v1/lookups/education") return json(LOOKUP);
    if (/^\/api\/v1\/packages\/[^/]+\/close$/.test(pathname)) {
      const id = pathname.split("/")[4];
      return json(packages.find((p) => p.id === id) ?? {}, 200);
    }
    return json({ error: "unexpected" }, 500);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MyPackagesPage />
    </QueryClientProvider>,
  );
}

/** The card article around a package's title heading. */
async function cardFor(title: string) {
  const heading = await screen.findByRole("heading", { name: title });
  const card = heading.closest("article");
  if (!card) throw new Error("package card not rendered");
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyPackagesPage", () => {
  it("shows the empty state with a New package link", async () => {
    mockApi([]);
    renderPage();

    expect(await screen.findByText("No packages yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Publish a package so students near your zones can request it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New package" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/packages/new",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("shows a live card with the offer, price, students and request actions", async () => {
    mockApi([
      pkg({
        id: "pkg-live",
        pendingRequestCount: 2,
        requestCount: 5,
        maxStudents: 5,
      }),
    ]);
    renderPage();

    const card = await cardFor("SSC Math Booster");
    expect(
      within(card).getByText("Full curriculum · 12 weeks"),
    ).toBeInTheDocument();
    expect(within(card).getByText("Mathematics")).toBeInTheDocument();
    expect(within(card).getByText("Up to 5 students")).toBeInTheDocument();
    expect(within(card).getByText("৳15,000")).toBeInTheDocument();
    expect(within(card).getByText("2 waiting")).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: "View requests" }),
    ).toHaveAttribute("href", "/dashboard/tutor/packages/pkg-live/requests");
    expect(within(card).getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/packages/pkg-live/edit",
    );
    expect(
      within(card).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Closed")).toBeNull();
  });

  it("warns when a live package has no zone and is not online", async () => {
    mockApi([pkg({ id: "pkg-lost", zoneCount: 0, teachesOnline: false })]);
    renderPage();

    const card = await cardFor("SSC Math Booster");
    expect(
      within(card).getByText(
        "Add a zone or turn on online teaching so students can find it.",
      ),
    ).toBeInTheDocument();
  });

  it("does not warn once the package is online", async () => {
    mockApi([pkg({ id: "pkg-online", zoneCount: 0, teachesOnline: true })]);
    renderPage();

    const card = await cardFor("SSC Math Booster");
    expect(
      within(card).queryByText(/students can't find it nearby/),
    ).toBeNull();
  });

  it("lists non-live packages under Closed with no Edit or Close", async () => {
    mockApi([
      pkg({ id: "pkg-live", status: "OPEN" }),
      pkg({ id: "pkg-old", status: "EXPIRED", title: "Old Physics Set" }),
    ]);
    renderPage();

    const heading = await screen.findByRole("heading", { name: "Closed" });
    const section = heading.closest("section") as HTMLElement;
    const oldCard = within(section).getByRole("article");

    expect(within(oldCard).getByText("Old Physics Set")).toBeInTheDocument();
    expect(
      within(oldCard).getByRole("link", { name: "View requests" }),
    ).toHaveAttribute("href", "/dashboard/tutor/packages/pkg-old/requests");
    expect(within(oldCard).queryByRole("link", { name: "Edit" })).toBeNull();
    expect(within(oldCard).queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("closes a package after confirming", async () => {
    const user = userEvent.setup();
    mockApi([pkg({ id: "pkg-live", status: "OPEN" })]);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Close" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Close this package?" }),
    ).toBeInTheDocument();

    // Nothing is sent until the tutor confirms.
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([url]) => String(url).includes("/close")),
    ).toBe(false);

    await user.click(
      within(dialog).getByRole("button", { name: "Close package" }),
    );

    await waitFor(() => {
      const closeCall = vi
        .mocked(apiFetch)
        .mock.calls.find(([url]) => String(url).includes("/close"));
      expect(closeCall).toBeDefined();
      const [url, init] = closeCall as [string, RequestInit];
      expect(new URL(url).pathname).toBe("/api/v1/packages/pkg-live/close");
      expect(init.method).toBe("POST");
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Package closed."),
    );
  });
});
