import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZonePicker } from "@/components/tutor-requirements/zone-picker";
import { useTutorZones, type TutorZone } from "@/lib/tutor-zones";

vi.mock("@/lib/tutor-zones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor-zones")>()),
  useTutorZones: vi.fn(),
}));

function zone(id: string, label: string, radiusM = 2000): TutorZone {
  return {
    id,
    label,
    lat: 23.8,
    lng: 90.4,
    radiusM,
    placeId: null,
    addressText: null,
    requirementIds: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
}

const ZONES = [zone("z1", "Dhanmondi"), zone("z2", "Mirpur", 3000)];

function mockZones(zones: TutorZone[]) {
  vi.mocked(useTutorZones).mockReturnValue({
    data: { zones, limit: 5, used: zones.length, pendingRequest: null },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTutorZones>);
}

const HINT =
  "To make this your default for applying, pick at least one zone or turn on online teaching.";

function renderPicker(props: Partial<Parameters<typeof ZonePicker>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <ZonePicker
      value={[]}
      onChange={onChange}
      teachesOnline={false}
      idPrefix="t"
      {...props}
    />,
  );
  return { onChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockZones(ZONES);
});

describe("ZonePicker", () => {
  it("renders each zone as a checkbox with its label and radius", () => {
    renderPicker({ value: ["z2"] });

    expect(
      screen.getByRole("checkbox", { name: "Dhanmondi · 2 km" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Mirpur · 3 km" }),
    ).toBeChecked();
  });

  it("calls onChange with the zone added when an unchecked zone is toggled", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker({ value: ["z2"] });

    await user.click(
      screen.getByRole("checkbox", { name: "Dhanmondi · 2 km" }),
    );

    expect(onChange).toHaveBeenCalledWith(["z2", "z1"]);
  });

  it("calls onChange with the zone removed when a checked zone is toggled", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker({ value: ["z1", "z2"] });

    await user.click(screen.getByRole("checkbox", { name: "Mirpur · 3 km" }));

    expect(onChange).toHaveBeenCalledWith(["z1"]);
  });

  it("links to the zones page to add a zone when the tutor has none", () => {
    mockZones([]);
    renderPicker();

    expect(
      screen.getByText("You haven't added any zones yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a zone" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/zones",
    );
    expect(screen.getByRole("link", { name: "Manage zones" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/zones",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("always links to manage zones when zones exist", () => {
    renderPicker();

    expect(screen.getByRole("link", { name: "Manage zones" })).toHaveAttribute(
      "href",
      "/dashboard/tutor/zones",
    );
    expect(
      screen.queryByRole("link", { name: "Add a zone" }),
    ).not.toBeInTheDocument();
  });

  it("shows the default-set hint when no zone is chosen and the set is not online", () => {
    mockZones([]);
    renderPicker({ value: [], teachesOnline: false });

    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it("hides the hint when online teaching is on or a zone is chosen", () => {
    const { unmount } = render(
      <ZonePicker value={[]} onChange={vi.fn()} teachesOnline idPrefix="a" />,
    );
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    unmount();

    renderPicker({ value: ["z1"], teachesOnline: false });
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("shows a loading line while zones load", () => {
    vi.mocked(useTutorZones).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTutorZones>);
    renderPicker();

    expect(screen.getByRole("status")).toHaveTextContent("Loading your zones…");
  });

  it("shows an error with a retry action when zones fail to load", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    vi.mocked(useTutorZones).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useTutorZones>);
    renderPicker();

    expect(screen.getByText("Couldn't load your zones.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
