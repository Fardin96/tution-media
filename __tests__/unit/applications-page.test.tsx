import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationsPage } from "@/components/applications/applications-page";
import {
  useMyApplications,
  useApplicationAction,
  type Application,
} from "@/lib/applications";
import { useEducationLookup } from "@/lib/education";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/dashboard/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/education", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/education")>();
  return { ...actual, useEducationLookup: vi.fn() };
});

vi.mock("@/lib/applications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/applications")>();
  return {
    ...actual,
    useMyApplications: vi.fn(),
    useApplicationAction: vi.fn(),
  };
});

function application(
  overrides: Partial<Application> & { id: string },
): Application {
  return {
    initiatedBy: "TUTOR",
    status: "PENDING",
    appliedAt: "2026-11-10T04:00:00.000Z",
    confirmedAt: null,
    endedAt: null,
    tutor: {
      id: "t1",
      name: "Rafiq Ahmed",
      gender: "MALE",
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
    },
    allowedActions: [],
    ...overrides,
  } as Application;
}

function mockList(
  applications: Application[],
  opts: { isPending?: boolean } = {},
) {
  vi.mocked(useMyApplications).mockReturnValue({
    data: opts.isPending
      ? undefined
      : { pages: [{ applications, nextCursor: null }], pageParams: [] },
    isPending: opts.isPending ?? false,
    isError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMyApplications>);
}

function renderPage(role: "TUTOR" | "STUDENT") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationsPage role={role} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  vi.mocked(useEducationLookup).mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useEducationLookup>);
  vi.mocked(useApplicationAction).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useApplicationAction>);
  mockList([]);
});

describe("ApplicationsPage", () => {
  it("shows the counterpart name for a tutor and a rated tutor name for a student", () => {
    mockList([application({ id: "a1" })]);
    const { unmount } = renderPage("TUTOR");
    expect(screen.getByText("Nadia Islam")).toBeInTheDocument();
    unmount();

    mockList([application({ id: "a1", initiatedBy: "STUDENT" })]);
    renderPage("STUDENT");
    expect(screen.getByText("Rafiq Ahmed")).toBeInTheDocument();
    expect(screen.getByText("4.5 (12)")).toBeInTheDocument();
  });

  it("writes the chosen status to the URL", async () => {
    const user = userEvent.setup();
    renderPage("TUTOR");

    await user.click(screen.getByRole("button", { name: "Confirmed" }));

    expect(nav.replace).toHaveBeenCalledWith(
      "/dashboard/applications?status=CONFIRMED",
      { scroll: false },
    );
  });

  it("clears the status param when All is chosen", async () => {
    const user = userEvent.setup();
    nav.search = "status=PENDING";
    renderPage("TUTOR");

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(nav.replace).toHaveBeenCalledWith("/dashboard/applications", {
      scroll: false,
    });
  });

  it("reads the status from the URL and passes it to the query", () => {
    nav.search = "status=COMPLETED";
    renderPage("STUDENT");

    expect(screen.getByRole("button", { name: "Completed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(useMyApplications).toHaveBeenLastCalledWith("COMPLETED");
  });

  it("falls back to All for an unknown status value", () => {
    nav.search = "status=bogus";
    renderPage("TUTOR");

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(useMyApplications).toHaveBeenLastCalledWith(undefined);
  });

  it("explains an empty filtered list and offers to show all", async () => {
    const user = userEvent.setup();
    nav.search = "status=CANCELLED";
    mockList([]);
    renderPage("TUTOR");

    expect(screen.getByText("No cancelled applications.")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show all applications" }),
    );
    expect(nav.replace).toHaveBeenCalledWith("/dashboard/applications", {
      scroll: false,
    });
  });

  it("renders the actions from each card's allowedActions", () => {
    mockList([
      application({
        id: "a1",
        status: "PENDING",
        allowedActions: ["withdraw"],
      }),
    ]);
    renderPage("TUTOR");

    const card = screen
      .getByRole("heading", { name: "Nadia Islam" })
      .closest("article");
    expect(card).not.toBeNull();
    const buttons = within(card as HTMLElement).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Withdraw"]);
  });

  it("shows a skeleton while loading", () => {
    mockList([], { isPending: true });
    renderPage("TUTOR");
    expect(screen.getByText("Loading applications")).toBeInTheDocument();
  });
});
