import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  EducationRangePicker,
  type EducationRangeValue,
} from "@/components/tutor-requirements/education-range-picker";
import { useEducationLookup, type EducationLookup } from "@/lib/education";

vi.mock("@/lib/education", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/education")>()),
  useEducationLookup: vi.fn(),
}));

const LOOKUP: EducationLookup = {
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
        { code: 0, label: "Nursery" },
        { code: 1, label: "Class 1" },
        { code: 8, label: "Class 8" },
        { code: 9, label: "Class 9" },
        { code: 12, label: "Class 12" },
        { code: 13, label: "Admission & test prep" },
      ],
      groups: [
        { code: "SCIENCE", label: "Science" },
        { code: "HUMANITIES", label: "Humanities" },
      ],
    },
    {
      code: "ENGLISH_VERSION",
      label: "English version",
      levels: [
        { code: 0, label: "Nursery" },
        { code: 9, label: "Class 9" },
        { code: 12, label: "Class 12" },
      ],
      groups: [],
    },
  ],
  admissionTargets: [
    { code: "ENGINEERING", label: "Engineering", covers: "BUET, KUET, DUET" },
    { code: "MEDICAL", label: "Medical", covers: "MBBS, BDS" },
  ],
  retakerLabels: [
    { level: 12, label: "Retake / improvement" },
    { level: 13, label: "2nd timer" },
  ],
};

const EMPTY: EducationRangeValue = {
  levelMin: null,
  levelMax: null,
  curricula: [],
  academicGroups: [],
  admissionTargets: [],
};

function Harness({ initial = EMPTY }: { initial?: EducationRangeValue }) {
  const [value, setValue] = useState<EducationRangeValue>(initial);
  return (
    <EducationRangePicker
      idPrefix="test"
      value={value}
      onChange={setValue}
      errors={{}}
    />
  );
}

beforeEach(() => {
  vi.mocked(useEducationLookup).mockReturnValue({
    data: LOOKUP,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useEducationLookup>);
});

describe("EducationRangePicker", () => {
  it("All toggles every curriculum", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const all = screen.getByRole("checkbox", { name: "All" });
    const bangla = screen.getByRole("checkbox", { name: "Bangla medium" });
    const english = screen.getByRole("checkbox", { name: "English version" });

    await user.click(all);
    expect(bangla).toBeChecked();
    expect(english).toBeChecked();
    expect(all).toBeChecked();

    await user.click(all);
    expect(bangla).not.toBeChecked();
    expect(english).not.toBeChecked();
    expect(all).not.toBeChecked();
  });

  it("disables the selects with no curricula", () => {
    render(<Harness />);

    expect(screen.getByLabelText("From")).toBeDisabled();
    expect(screen.getByLabelText("To")).toBeDisabled();
  });

  it("shows the admission targets when To is 13", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: "Bangla medium" }));
    expect(
      screen.queryByText("Admission targets (optional, none means any)"),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("To"), "13");
    expect(
      screen.getByText("Admission targets (optional, none means any)"),
    ).toBeInTheDocument();
  });

  it("hides the groups for a range of 1 to 8", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: "Bangla medium" }));
    await user.selectOptions(screen.getByLabelText("From"), "1");
    await user.selectOptions(screen.getByLabelText("To"), "8");

    expect(
      screen.queryByText("Groups (optional, none means any)"),
    ).not.toBeInTheDocument();
  });
});
