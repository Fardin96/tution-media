import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TutorZonesPage } from "@/components/tutor-zones/tutor-zones-page";
import {
  tutorZoneApi,
  useTutorZones,
  type TutorZone,
  type ZoneList,
  type ZoneLimitRequest,
} from "@/lib/tutor-zones";
import {
  useTutorRequirements,
  type TutorRequirement,
} from "@/lib/tutor-requirements";

vi.mock("@/components/tutor-zones/zone-limit-request-dialog", () => ({
  ZoneLimitRequestDialog: () => null,
}));

vi.mock("@/components/tutor-zones/zone-map", () => ({
  hasMapsKey: () => !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  ZoneMap: ({ dropping }: { dropping?: boolean }) => (
    <div data-testid="zone-map" data-dropping={String(!!dropping)} />
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/tutor-zones", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tutor-zones")>();
  return {
    ...actual,
    useTutorZones: vi.fn(),
    tutorZoneApi: {
      ...actual.tutorZoneApi,
      remove: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock("@/lib/tutor-requirements", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/tutor-requirements")>();
  return { ...actual, useTutorRequirements: vi.fn() };
});

function zone(overrides: Partial<TutorZone> & { id: string }): TutorZone {
  return {
    label: "Zone",
    lat: 23.8,
    lng: 90.4,
    radiusM: 2000,
    placeId: null,
    addressText: null,
    requirementIds: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function requirement(
  overrides: Partial<TutorRequirement> & { id: string; name: string },
): TutorRequirement {
  return {
    isDefault: false,
    isActive: true,
    levelMin: 9,
    levelMax: 9,
    curricula: ["BANGLA_MEDIUM"],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 127,
    minSalary: null,
    maxStudents: 1,
    availableFrom: "2026-11-01",
    teachesOnline: false,
    subjectIds: [1],
    zoneIds: [],
    mappedPackageCount: 0,
    ...overrides,
  } as TutorRequirement;
}

function pendingRequest(requestedLimit: number): ZoneLimitRequest {
  return {
    id: "req-1",
    requestedLimit,
    reason: "I teach in three neighbourhoods this term.",
    status: "PENDING",
    decisionNote: null,
    decidedAt: null,
    createdAt: "2026-11-02T00:00:00.000Z",
  };
}

function mockZones(list: ZoneList | undefined) {
  vi.mocked(useTutorZones).mockReturnValue({
    data: list,
    isPending: list === undefined,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTutorZones>);
}

function mockRequirements(data: TutorRequirement[] | undefined) {
  vi.mocked(useTutorRequirements).mockReturnValue({
    data,
    isPending: data === undefined,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTutorRequirements>);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TutorZonesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Without a key the map shows its fallback, so no Google code runs in tests.
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
  mockRequirements([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TutorZonesPage", () => {
  it("lists the zones with their radius and set count", () => {
    mockZones({
      zones: [
        zone({
          id: "z1",
          label: "Dhanmondi",
          radiusM: 2500,
          addressText: "Road 27, Dhaka",
          requirementIds: ["r1", "r2"],
        }),
        zone({ id: "z2", label: "Gulshan", radiusM: 1000 }),
      ],
      limit: 5,
      used: 2,
      pendingRequest: null,
    });
    renderPage();

    expect(screen.getByText("2 of 5 zones used")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Your zones" });
    expect(within(list).getByText("Dhanmondi")).toBeInTheDocument();
    expect(
      within(list).getByText("2.5 km · Used by 2 sets"),
    ).toBeInTheDocument();
    expect(within(list).getByText("Road 27, Dhaka")).toBeInTheDocument();
    expect(within(list).getByText("Gulshan")).toBeInTheDocument();
    expect(
      within(list).getByText("1 km · Not used by any set"),
    ).toBeInTheDocument();
  });

  it("disables Add zone at the limit and offers to ask for more", () => {
    mockZones({
      zones: [zone({ id: "z1", label: "Dhanmondi" })],
      limit: 1,
      used: 1,
      pendingRequest: null,
    });
    renderPage();

    expect(screen.getByRole("button", { name: "Add zone" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Ask for more zones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You've used all 1 zone. Delete one or ask for more."),
    ).toBeInTheDocument();
  });

  it("shows the pending request instead of the ask button", () => {
    mockZones({
      zones: [zone({ id: "z1", label: "Dhanmondi" })],
      limit: 1,
      used: 1,
      pendingRequest: pendingRequest(4),
    });
    renderPage();

    expect(screen.getByText("Request for 4 zones pending")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ask for more zones" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Add zone enabled below the limit", () => {
    mockZones({
      zones: [zone({ id: "z1", label: "Dhanmondi" })],
      limit: 5,
      used: 1,
      pendingRequest: null,
    });
    renderPage();

    expect(screen.getByRole("button", { name: "Add zone" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Ask for more zones" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state with an add action when there are no zones", () => {
    mockZones({ zones: [], limit: 5, used: 0, pendingRequest: null });
    renderPage();

    expect(screen.getByText("No zones yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add your first zone" }),
    ).toBeEnabled();
  });

  it("warns before deleting the only zone of a default in-person set", async () => {
    mockZones({
      zones: [zone({ id: "z1", label: "Dhanmondi", requirementIds: ["r1"] })],
      limit: 5,
      used: 1,
      pendingRequest: null,
    });
    mockRequirements([
      requirement({
        id: "r1",
        name: "Main set",
        isDefault: true,
        isActive: true,
        teachesOnline: false,
        zoneIds: ["z1"],
      }),
    ]);
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: /Delete Dhanmondi/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Main set")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Main set is your default set. You can't apply to tuitions until it gets another zone or teaches online.",
      ),
    ).toBeInTheDocument();
  });

  it("does not warn when the default set teaches online", async () => {
    mockZones({
      zones: [zone({ id: "z1", label: "Dhanmondi", requirementIds: ["r1"] })],
      limit: 5,
      used: 1,
      pendingRequest: null,
    });
    mockRequirements([
      requirement({
        id: "r1",
        name: "Main set",
        isDefault: true,
        teachesOnline: true,
        zoneIds: ["z1"],
      }),
    ]);
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: /Delete Dhanmondi/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("1 requirement set uses this zone:"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/You can't apply to tuitions/),
    ).not.toBeInTheDocument();
  });

  it("deletes the zone after confirmation", async () => {
    mockZones({
      zones: [zone({ id: "z1", label: "Dhanmondi" })],
      limit: 5,
      used: 1,
      pendingRequest: null,
    });
    vi.mocked(tutorZoneApi.remove).mockResolvedValue({
      id: "z1",
      affectedRequirements: [],
    });
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: /Delete Dhanmondi/ }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete zone" }),
    );

    expect(tutorZoneApi.remove).toHaveBeenCalledWith("z1");
  });
});

describe("drop pin", () => {
  function mockOneZone(used: number, limit: number) {
    mockZones({
      zones: [zone({ id: "z1", label: "Dhanmondi" })],
      limit,
      used,
      pendingRequest: null,
    });
  }

  it("is not rendered without a Maps key", () => {
    mockOneZone(1, 5);
    renderPage();

    expect(
      screen.queryByRole("button", { name: "Drop pin" }),
    ).not.toBeInTheDocument();
  });

  it("opens a new zone and turns drop mode on", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    mockOneZone(1, 5);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Drop pin" }));

    expect(
      screen.getByRole("heading", { name: "Add zone" }),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Drop pin" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("zone-map")).toHaveAttribute(
      "data-dropping",
      "true",
    );
    expect(
      screen.getByText("Click or tap the map to place the pin."),
    ).toBeInTheDocument();
  });

  it("turns drop mode off when clicked again", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    mockOneZone(1, 5);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Drop pin" }));
    await userEvent.click(screen.getByRole("button", { name: "Drop pin" }));

    expect(screen.getByRole("button", { name: "Drop pin" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByTestId("zone-map")).toHaveAttribute(
      "data-dropping",
      "false",
    );
  });

  it("turns drop mode off when Escape is pressed", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    mockOneZone(1, 5);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Drop pin" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Drop pin" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("starts drop mode from Add zone", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    mockOneZone(1, 5);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Add zone" }));

    expect(screen.getByRole("button", { name: "Drop pin" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("zone-map")).toHaveAttribute(
      "data-dropping",
      "true",
    );
  });

  it("is disabled at the zone limit when no editor is open", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    mockOneZone(1, 1);
    renderPage();

    expect(screen.getByRole("button", { name: "Drop pin" })).toBeDisabled();
  });
});
