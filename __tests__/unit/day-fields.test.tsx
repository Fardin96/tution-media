import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DaysOfWeekField,
  DaysPerWeekField,
} from "@/components/requirements/day-fields";

describe("DaysOfWeekField", () => {
  it("shows a checked chip for each bit in the mask", () => {
    render(<DaysOfWeekField idPrefix="t" value={1 | 64} onChange={() => {}} />);

    expect(screen.getByRole("checkbox", { name: "Saturday" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Friday" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Monday" })).not.toBeChecked();
  });

  it("toggles one day's bit through onChange", async () => {
    const onChange = vi.fn();
    render(<DaysOfWeekField idPrefix="t" value={1 | 4} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Monday" }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    await userEvent.click(screen.getByRole("checkbox", { name: "Tuesday" }));
    expect(onChange).toHaveBeenLastCalledWith(1 | 4 | 8);
  });

  it("shows the error text and links it to the group", () => {
    render(
      <DaysOfWeekField
        idPrefix="t"
        value={0}
        onChange={() => {}}
        error="Choose at least one day."
      />,
    );

    expect(screen.getByText("Choose at least one day.")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Days" }),
    ).toHaveAccessibleDescription("Choose at least one day.");
  });
});

describe("DaysPerWeekField", () => {
  it("marks the selected count and calls onChange with the number", async () => {
    const onChange = vi.fn();
    render(<DaysPerWeekField idPrefix="t" value={3} onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "3" })).toBeChecked();
    expect(screen.getByText("3 days a week")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "5" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("describes an unset count as any number of days", () => {
    render(<DaysPerWeekField idPrefix="t" value={null} onChange={() => {}} />);
    expect(screen.getByText("Any number of days")).toBeInTheDocument();
  });

  it("shows the error text", () => {
    render(
      <DaysPerWeekField
        idPrefix="t"
        value={5}
        onChange={() => {}}
        error="Pick at least 5 days, or fewer days a week."
      />,
    );
    expect(
      screen.getByText("Pick at least 5 days, or fewer days a week."),
    ).toBeInTheDocument();
  });
});
