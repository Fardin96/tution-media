import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/SearchBar";
import { SITE_CONTENT_DEFAULTS } from "@/lib/site-content";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  loadSubjects: vi.fn(),
  loadAreas: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/subjects", () => ({ loadSubjects: mocks.loadSubjects }));
vi.mock("@/lib/areas", () => ({ loadAreas: mocks.loadAreas }));

const SUBJECTS = [
  { id: 1, name: "Mathematics" },
  { id: 2, name: "Physics" },
];
const AREAS = [
  { id: 10, name: "Gulshan", district: "Dhaka" },
  { id: 11, name: "Dhanmondi", district: "Dhaka" },
];

const hero = SITE_CONTENT_DEFAULTS.hero;

function renderBar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SearchBar {...hero} />
    </QueryClientProvider>,
  );
}

const subject = () => screen.getByRole("combobox", { name: "Subject" });
const location = () => screen.getByRole("combobox", { name: "Location" });
const search = () => screen.getByRole("button", { name: /search/i });

describe("SearchBar", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.loadSubjects.mockReset().mockResolvedValue(SUBJECTS);
    mocks.loadAreas.mockReset().mockResolvedValue(AREAS);
  });

  it("renders two comboboxes and a submit button", () => {
    renderBar();
    expect(subject()).toHaveAttribute("aria-autocomplete", "list");
    expect(location()).toBeInTheDocument();
    expect(search()).toBeInTheDocument();
  });

  it("loads the lists only after the first focus", async () => {
    renderBar();
    expect(mocks.loadSubjects).not.toHaveBeenCalled();
    expect(mocks.loadAreas).not.toHaveBeenCalled();

    await userEvent.click(subject());
    await waitFor(() => expect(mocks.loadSubjects).toHaveBeenCalledTimes(1));
    expect(mocks.loadAreas).toHaveBeenCalledTimes(1);
  });

  it("shows a subject suggestion while typing", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    const list = await screen.findByRole("listbox", {
      name: "Subject suggestions",
    });
    expect(list).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Physics" })).toBeInTheDocument();
  });

  it("ArrowDown and Enter pick a suggestion without submitting, then submit the subject id", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    await screen.findByRole("option", { name: "Physics" });

    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(subject()).toHaveValue("Physics");
    await waitFor(() =>
      expect(
        screen.queryByRole("listbox", { name: "Subject suggestions" }),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(search());
    expect(mocks.push).toHaveBeenCalledWith("/tutors?subject=2");
  });

  it("picking the district Dhaka submits district=Dhaka", async () => {
    renderBar();
    await userEvent.type(location(), "Dha");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Dhaka/ }),
    );
    expect(location()).toHaveValue("Dhaka");

    await userEvent.click(search());
    expect(mocks.push).toHaveBeenCalledWith("/tutors?district=Dhaka");
  });

  it("picking an area submits area=<id>", async () => {
    renderBar();
    await userEvent.type(location(), "Gul");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Gulshan/ }),
    );
    expect(location()).toHaveValue("Gulshan, Dhaka");

    await userEvent.click(search());
    expect(mocks.push).toHaveBeenCalledWith("/tutors?area=10");
  });

  it("submits typed text that was never picked as q and location", async () => {
    renderBar();
    await userEvent.type(subject(), "Math Tutor");
    await userEvent.type(location(), "Dhaka");
    await userEvent.click(search());
    expect(mocks.push).toHaveBeenCalledWith(
      "/tutors?q=Math+Tutor&location=Dhaka",
    );
  });

  it("pushes /tutors when both fields are empty", async () => {
    renderBar();
    await userEvent.click(search());
    expect(mocks.push).toHaveBeenCalledWith("/tutors");
  });

  it("Escape closes the listbox and keeps the text", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    await screen.findByRole("option", { name: "Physics" });

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("listbox", { name: "Subject suggestions" }),
      ).not.toBeInTheDocument(),
    );
    expect(subject()).toHaveValue("phy");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("editing a picked suggestion drops the pick, so the text goes as q", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    await screen.findByRole("option", { name: "Physics" });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(subject()).toHaveValue("Physics");

    await userEvent.keyboard("{Backspace}");
    await userEvent.click(search());
    expect(mocks.push).toHaveBeenCalledWith("/tutors?q=Physic");
  });

  it("ArrowUp from no highlight wraps to the last row, and ArrowDown from the last wraps to the first", async () => {
    renderBar();
    await userEvent.type(subject(), "s");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);

    await userEvent.keyboard("{ArrowUp}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Tab closes the popup", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    await screen.findByRole("option", { name: "Physics" });

    await userEvent.keyboard("{Tab}");
    await waitFor(() =>
      expect(
        screen.queryByRole("listbox", { name: "Subject suggestions" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("leaving the field closes the popup", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    await screen.findByRole("option", { name: "Physics" });

    await userEvent.click(document.body);
    await waitFor(() =>
      expect(
        screen.queryByRole("listbox", { name: "Subject suggestions" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("aria-controls is absent while closed, and points at the listbox while open", async () => {
    renderBar();
    expect(subject()).not.toHaveAttribute("aria-controls");

    await userEvent.type(subject(), "phy");
    const list = await screen.findByRole("listbox", {
      name: "Subject suggestions",
    });
    expect(subject()).toHaveAttribute("aria-controls", list.id);
    expect(subject()).not.toHaveAttribute("aria-activedescendant");

    await userEvent.keyboard("{ArrowDown}");
    expect(subject()).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Physics" }).id,
    );
  });

  it("announces the suggestion count, singular and plural", async () => {
    renderBar();
    await userEvent.type(subject(), "s");
    expect(await screen.findByText("2 suggestions")).toBeInTheDocument();

    await userEvent.clear(subject());
    await userEvent.type(subject(), "phy");
    expect(await screen.findByText("1 suggestion")).toBeInTheDocument();
  });

  it("ignores keydown during IME composition", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    const option = await screen.findByRole("option", { name: "Physics" });

    fireEvent.keyDown(subject(), { key: "ArrowDown", isComposing: true });
    expect(option).toHaveAttribute("aria-selected", "false");
    expect(subject()).not.toHaveAttribute("aria-activedescendant");
  });

  it("Enter with nothing highlighted submits and closes the listbox", async () => {
    renderBar();
    await userEvent.type(subject(), "phy");
    await screen.findByRole("option", { name: "Physics" });

    await userEvent.keyboard("{Enter}");
    expect(mocks.push).toHaveBeenCalledWith("/tutors?q=phy");
    await waitFor(() =>
      expect(
        screen.queryByRole("listbox", { name: "Subject suggestions" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("a failed lookup gives no suggestions, and refocusing retries it", async () => {
    mocks.loadSubjects
      .mockReset()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(SUBJECTS);
    renderBar();

    await userEvent.type(subject(), "phy");
    await waitFor(() => expect(mocks.loadSubjects).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await userEvent.tab();
    await userEvent.click(subject());
    await screen.findByRole("option", { name: "Physics" });
    expect(mocks.loadSubjects).toHaveBeenCalledTimes(2);
  });

  it("a mouse move over a row highlights it, and a repeat move over the same row keeps it", async () => {
    renderBar();
    await userEvent.type(subject(), "s");
    const physics = await screen.findByRole("option", { name: "Physics" });
    const mathematics = screen.getByRole("option", { name: "Mathematics" });

    fireEvent.mouseMove(physics);
    expect(physics).toHaveAttribute("aria-selected", "true");
    expect(mathematics).toHaveAttribute("aria-selected", "false");

    fireEvent.mouseMove(physics);
    expect(physics).toHaveAttribute("aria-selected", "true");
    expect(subject()).toHaveAttribute("aria-activedescendant", physics.id);
  });
});
