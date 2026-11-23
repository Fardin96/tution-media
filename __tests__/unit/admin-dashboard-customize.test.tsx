import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  countLayoutChanges,
  moveWidget,
  useResetDashboardLayout,
  useSaveDashboardLayout,
  type CatalogItem,
  type DashboardLayout,
  type WidgetId,
} from "@/lib/admin-dashboard";
import { CustomizeSheet } from "@/components/admin/dashboard/customize-sheet";

vi.mock("@/lib/admin-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-dashboard")>();
  return {
    ...actual,
    useSaveDashboardLayout: vi.fn(),
    useResetDashboardLayout: vi.fn(),
  };
});

function item(
  id: string,
  title: string,
  group: CatalogItem["group"],
): CatalogItem {
  return {
    id,
    title,
    description: `${title} description`,
    definition: "",
    group,
    kind: "kpi",
    span: 3,
    keywords: [],
    href: null,
    defaultOn: true,
  } as unknown as CatalogItem;
}

const catalog: CatalogItem[] = [
  item("bottleneck", "Bottleneck", "pipeline"),
  item("mau", "Monthly active users", "people"),
  item("collected", "Collected", "money"),
  item("queues", "Queues", "operations"),
  item("trust-cases", "Trust cases", "trust"),
];

function layoutWith(
  widgets: string[],
  items: CatalogItem[] = catalog,
): DashboardLayout {
  return {
    catalog: items,
    widgets: widgets as WidgetId[],
    isDefault: false,
    updatedAt: null,
  } as unknown as DashboardLayout;
}

let save: ReturnType<typeof vi.fn>;

function setup(
  layout: DashboardLayout,
  { pending = false, resetPending = false } = {},
) {
  save = vi.fn().mockResolvedValue(layout);
  vi.mocked(useSaveDashboardLayout).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: save,
    isPending: pending,
  } as never);
  vi.mocked(useResetDashboardLayout).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(layout),
    isPending: resetPending,
  } as never);
  const onOpenChange = vi.fn();
  const user = userEvent.setup();
  render(<CustomizeSheet open onOpenChange={onOpenChange} layout={layout} />);
  return { user, onOpenChange };
}

/** Labels of the "On your dashboard" rows, top to bottom. */
function dashboardOrder() {
  const region = screen.getByRole("region", { name: "On your dashboard" });
  return within(region)
    .getAllByRole("listitem")
    .map((li) => li.querySelector("p")?.textContent);
}

describe("CustomizeSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the draft on top and the catalog below, grouped in the label order", () => {
    setup(layoutWith(["bottleneck"]));
    expect(dashboardOrder()).toEqual(["Bottleneck"]);
    const add = screen.getByRole("region", { name: "Add widgets" });
    const headings = within(add)
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["People", "Money", "Operations", "Trust"]);
    expect(
      within(add).queryByRole("switch", { name: "Bottleneck" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Collected" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("switch", { name: "Bottleneck" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("counts changes when a switch is toggled", async () => {
    const { user } = setup(layoutWith(["bottleneck", "mau"]));
    expect(screen.queryByText(/changes?$/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Queues" }));
    expect(screen.getByText("1 change")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Bottleneck" }));
    expect(screen.getByText("2 changes")).toBeInTheDocument();
  });

  it("moves a widget down, visibly reorders the list, keeps focus on it, and saves", async () => {
    const layout = layoutWith(["bottleneck", "mau", "collected"]);
    const { user } = setup(layout);
    expect(dashboardOrder()).toEqual([
      "Bottleneck",
      "Monthly active users",
      "Collected",
    ]);
    await user.click(
      screen.getByRole("button", { name: "Move Bottleneck down" }),
    );
    expect(dashboardOrder()).toEqual([
      "Monthly active users",
      "Bottleneck",
      "Collected",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Moved Bottleneck to position 2 of 3.",
    );
    expect(
      screen.getByRole("button", { name: "Move Bottleneck down" }),
    ).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(["mau", "bottleneck", "collected"]),
    );
  });

  it("disables Move up on the first row and Move down on the last", () => {
    setup(layoutWith(["bottleneck", "mau"]));
    expect(
      screen.getByRole("button", { name: "Move Bottleneck up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Monthly active users down" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Bottleneck down" }),
    ).toBeEnabled();
  });

  it("adding from Add widgets moves the widget to the end of the dashboard list", async () => {
    const { user } = setup(layoutWith(["bottleneck", "mau"]));
    await user.click(screen.getByRole("switch", { name: "Queues" }));
    expect(dashboardOrder()).toEqual([
      "Bottleneck",
      "Monthly active users",
      "Queues",
    ]);
    const add = screen.getByRole("region", { name: "Add widgets" });
    expect(
      within(add).queryByRole("switch", { name: "Queues" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added Queues at position 3 of 3.",
    );
  });

  it("removing from the dashboard list returns the widget to Add widgets", async () => {
    const { user } = setup(layoutWith(["bottleneck", "mau"]));
    await user.click(screen.getByRole("switch", { name: "Bottleneck" }));
    expect(dashboardOrder()).toEqual(["Monthly active users"]);
    const add = screen.getByRole("region", { name: "Add widgets" });
    expect(
      within(add).getByRole("switch", { name: "Bottleneck" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Removed Bottleneck.");
  });

  it("disables Reset to default while a save is pending", () => {
    setup(layoutWith(["bottleneck", "mau"]), { pending: true });
    expect(
      screen.getByRole("button", { name: "Reset to default" }),
    ).toBeDisabled();
  });

  it("disables Save while a reset is pending", async () => {
    const { user } = setup(layoutWith(["bottleneck", "mau"]), {
      resetPending: true,
    });
    await user.click(screen.getByRole("switch", { name: "Queues" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("asks before discarding unsaved changes on close", async () => {
    const { user, onOpenChange } = setup(
      layoutWith(["bottleneck", "mau", "collected"]),
    );
    await user.click(screen.getByRole("switch", { name: "Queues" }));
    await user.keyboard("{Escape}");

    const confirm = await screen.findByRole("alertdialog", {
      name: "Discard unsaved changes?",
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await user.click(
      within(confirm).getByRole("button", { name: "Keep editing" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", { name: "Discard unsaved changes?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("disables the last ON switch", () => {
    setup(layoutWith(["mau"]));
    expect(
      screen.getByRole("switch", { name: "Monthly active users" }),
    ).toBeDisabled();
    expect(screen.getByText("Keep at least one widget.")).toBeInTheDocument();
  });

  it("disables OFF switches when the dashboard is full at 24 widgets", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      item(`w${i}`, `Widget ${i}`, "pipeline"),
    );
    const ids = many.slice(0, 24).map((w) => w.id);
    setup(layoutWith(ids, many));
    expect(
      screen.getByText(
        "Your dashboard is full (24 widgets). Remove one to add another.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Widget 24" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Widget 0" })).toBeEnabled();
  });
});

const ids = (...list: string[]) => list as unknown as WidgetId[];

describe("countLayoutChanges", () => {
  it("counts added, removed and moved rows", () => {
    expect(
      countLayoutChanges(ids("bottleneck", "mau"), ids("bottleneck", "mau")),
    ).toBe(0);
    expect(
      countLayoutChanges(
        ids("bottleneck", "mau"),
        ids("bottleneck", "mau", "collected"),
      ),
    ).toBe(1);
    expect(
      countLayoutChanges(ids("bottleneck", "mau"), ids("bottleneck")),
    ).toBe(1);
    expect(
      countLayoutChanges(
        ids("bottleneck", "mau", "collected"),
        ids("collected", "mau", "bottleneck"),
      ),
    ).toBe(2);
  });
});

describe("moveWidget", () => {
  it("swaps the id with its neighbour", () => {
    expect(
      moveWidget(ids("bottleneck", "mau", "collected"), ids("mau")[0], -1),
    ).toEqual(ids("mau", "bottleneck", "collected"));
    expect(
      moveWidget(ids("bottleneck", "mau", "collected"), ids("mau")[0], 1),
    ).toEqual(ids("bottleneck", "collected", "mau"));
  });

  it("returns the same list for an out-of-range or unknown move", () => {
    const list = ids("bottleneck", "mau");
    expect(moveWidget(list, ids("bottleneck")[0], -1)).toBe(list);
    expect(moveWidget(list, ids("mau")[0], 1)).toBe(list);
    expect(moveWidget(list, ids("queues")[0], 1)).toBe(list);
  });
});
