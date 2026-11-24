import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  InstitutionPicker,
  type InstitutionValue,
} from "@/components/profile/institution-picker";
import { institutionApi, type InstitutionOption } from "@/lib/institutions";

const HINT = "Pick it from the list, or type the full name if it isn't there.";

const VNSC: InstitutionOption = {
  id: 7,
  name: "Viqarunnisa Noon School and College",
  kind: "SCHOOL_AND_COLLEGE",
  district: "Dhaka",
  area: "Dhanmondi",
  matchedAlias: "VNSC",
};
const DU: InstitutionOption = {
  id: 2,
  name: "University of Dhaka",
  kind: "UNIVERSITY",
  district: "Dhaka",
  area: null,
  matchedAlias: null,
};

// Keeps the value in state, like the forms do, so typing and picking behave as they do in the app.
function Harness({ onChange }: { onChange: (next: InstitutionValue) => void }) {
  const [value, setValue] = useState<InstitutionValue>({
    name: "",
    institutionId: null,
  });
  return (
    <>
      <label htmlFor="school">School or college</label>
      <InstitutionPicker
        id="school"
        value={value}
        forRole="student"
        hint={HINT}
        maxLength={200}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </>
  );
}

function mockSearch(list: InstitutionOption[]) {
  return vi.spyOn(institutionApi, "search").mockResolvedValue(list);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InstitutionPicker", () => {
  it("does not search until two characters are typed", async () => {
    const search = mockSearch([DU]);
    render(<Harness onChange={vi.fn()} />);

    await userEvent.type(screen.getByRole("combobox"), "V");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(search).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole("combobox"), "i");
    await waitFor(() =>
      expect(search).toHaveBeenCalledWith(
        "Vi",
        "student",
        expect.any(AbortSignal),
      ),
    );
  });

  it("shows each option's name, kind and place, and the alias it matched", async () => {
    mockSearch([VNSC, DU]);
    render(<Harness onChange={vi.fn()} />);

    await userEvent.type(screen.getByRole("combobox"), "vnsc");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);

    expect(within(options[0]).getByText(VNSC.name)).toHaveClass(
      "font-semibold",
    );
    expect(options[0]).toHaveTextContent(
      "School and college · Dhanmondi, Dhaka",
    );
    expect(options[0]).toHaveTextContent("matches “VNSC”");

    expect(options[1]).toHaveTextContent("University · Dhaka");
    expect(options[1]).not.toHaveTextContent("matches");
  });

  it("picking a row sets its id and marks the field as picked", async () => {
    mockSearch([DU]);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox"), "dhaka");
    await userEvent.click(
      await screen.findByRole("option", { name: /University of Dhaka/ }),
    );

    expect(onChange).toHaveBeenLastCalledWith({
      name: "University of Dhaka",
      institutionId: 2,
    });
    expect(screen.getByRole("combobox")).toHaveValue("University of Dhaka");
    expect(screen.getByText("From the list")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("typing after a pick clears the id and keeps the text", async () => {
    mockSearch([DU]);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox"), "dhaka");
    await userEvent.click(
      await screen.findByRole("option", { name: /University of Dhaka/ }),
    );
    await userEvent.type(screen.getByRole("combobox"), "x");

    expect(onChange).toHaveBeenLastCalledWith({
      name: "University of Dhakax",
      institutionId: null,
    });
    expect(screen.queryByText("From the list")).not.toBeInTheDocument();
  });

  it("moves through the list with the arrow keys and picks with Enter", async () => {
    mockSearch([VNSC, DU]);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "dh");
    await screen.findByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", "school-listbox");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "school-option-1");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "school-option-0");

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({
      name: VNSC.name,
      institutionId: 7,
    });
  });

  it("Escape closes the list, and aria-controls always points at the listbox", async () => {
    mockSearch([DU]);
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-controls", "school-listbox");
    expect(document.getElementById("school-listbox")).toBeInTheDocument();

    await userEvent.type(input, "dh");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-controls", "school-listbox");
    expect(document.getElementById("school-listbox")).not.toBeVisible();
  });

  it("closes the list when focus leaves the field", async () => {
    mockSearch([DU]);
    render(
      <>
        <Harness onChange={vi.fn()} />
        <button type="button">Next field</button>
      </>,
    );
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "dh");
    await screen.findByRole("listbox");
    await userEvent.tab();

    expect(screen.getByRole("button", { name: "Next field" })).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("school-listbox")).not.toBeVisible();
  });

  it("ArrowDown reopens the list after Escape, and Alt+ArrowDown does too", async () => {
    mockSearch([VNSC, DU]);
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "dh");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("says so when a search of two or more characters finds nothing", async () => {
    mockSearch([]);
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "Zzz");
    expect(
      await screen.findByText("Not on the list. Type the full name."),
    ).toBeVisible();
    expect(input).toHaveAccessibleDescription(
      expect.stringContaining("Not on the list. Type the full name."),
    );
  });

  it("does not show the no-match note before two characters", async () => {
    mockSearch([]);
    render(<Harness onChange={vi.fn()} />);

    await userEvent.type(screen.getByRole("combobox"), "Z");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(
      screen.queryByText("Not on the list. Type the full name."),
    ).not.toBeInTheDocument();
  });

  it("says From the list through the input's description once picked", async () => {
    mockSearch([DU]);
    render(<Harness onChange={vi.fn()} />);

    await userEvent.type(screen.getByRole("combobox"), "dhaka");
    await userEvent.click(
      await screen.findByRole("option", { name: /University of Dhaka/ }),
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveAccessibleDescription(
      expect.stringContaining("From the list"),
    );
  });

  it("a failed search shows no list and the field still takes free text", async () => {
    vi.spyOn(institutionApi, "search").mockRejectedValue(new Error("offline"));
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox"), "Hol");
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("Hol");
    expect(onChange).toHaveBeenLastCalledWith({
      name: "Hol",
      institutionId: null,
    });
  });

  it("shows the hint under the field", () => {
    render(<Harness onChange={vi.fn()} />);
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });
});
