import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { EducationLevelPicker } from "@/components/requirements/education-level-picker";
import {
  emptyEducation,
  useEducationLookup,
  type EducationFields,
  type EducationLookup,
} from "@/lib/education";

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

function lookupResult(overrides: Record<string, unknown> = {}) {
  return {
    data: LOOKUP,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useEducationLookup>;
}

beforeEach(() => {
  vi.mocked(useEducationLookup).mockReturnValue(lookupResult());
});

/** Stateful wrapper so the controlled picker behaves like it does in the form. */
function Harness({ initial = emptyEducation }: { initial?: EducationFields }) {
  const [value, setValue] = useState(initial);
  return (
    <EducationLevelPicker
      idPrefix="t"
      value={value}
      errors={{}}
      onChange={setValue}
    />
  );
}

async function chooseCurriculum(name: string) {
  await userEvent.click(screen.getByRole("radio", { name }));
}

async function chooseLevel(value: string) {
  await userEvent.selectOptions(screen.getByLabelText("Class"), value);
}

describe("EducationLevelPicker", () => {
  it("enables the level select only after a curriculum is chosen", async () => {
    render(<Harness />);

    const select = screen.getByLabelText("Class");
    expect(select).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Choose a curriculum first" }),
    ).toBeInTheDocument();

    await chooseCurriculum("Bangla medium");

    expect(select).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "Choose a class" }),
    ).toBeInTheDocument();
  });

  it("passes level 0 through as levelCode 0", async () => {
    const onChange = vi.fn();
    render(
      <EducationLevelPicker
        idPrefix="t"
        value={{ ...emptyEducation, curriculum: "BANGLA_MEDIUM" }}
        errors={{}}
        onChange={onChange}
      />,
    );

    await chooseLevel("0");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ curriculum: "BANGLA_MEDIUM", levelCode: 0 }),
    );
  });

  it("shows group chips only at levels 9-12 for a curriculum with groups", async () => {
    render(<Harness />);
    await chooseCurriculum("Bangla medium");
    const groupGroup = () =>
      screen.queryByRole("radiogroup", { name: "Group (optional)" });

    await chooseLevel("8");
    expect(groupGroup()).toBeNull();

    await chooseLevel("9");
    expect(groupGroup()).not.toBeNull();
    expect(screen.getByRole("radio", { name: "No group" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Science" })).toBeInTheDocument();

    await chooseLevel("12");
    expect(groupGroup()).not.toBeNull();

    await chooseLevel("13");
    expect(groupGroup()).toBeNull();
  });

  it("shows no group chips for a curriculum without groups", async () => {
    render(<Harness />);
    await chooseCurriculum("English version");

    await chooseLevel("9");

    expect(
      screen.queryByRole("radiogroup", { name: "Group (optional)" }),
    ).toBeNull();
  });

  it("shows targets and the 2nd timer chip only at level 13", async () => {
    render(<Harness />);
    await chooseCurriculum("Bangla medium");
    const targets = () =>
      screen.queryByRole("group", { name: "Preparing for (optional)" });

    await chooseLevel("12");
    expect(targets()).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "2nd timer" })).toBeNull();

    await chooseLevel("13");
    expect(targets()).not.toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "2nd timer" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("BUET, KUET, DUET")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Engineering" }),
    );
    expect(screen.getByText(/Covers: BUET, KUET, DUET/)).toBeInTheDocument();
  });

  it("updates the note counter as the note is typed", async () => {
    render(
      <Harness
        initial={{
          ...emptyEducation,
          curriculum: "BANGLA_MEDIUM",
          levelCode: 9,
        }}
      />,
    );

    const note = screen.getByLabelText("Note for tutors (optional)");
    expect(note).toHaveAttribute("maxLength", "40");
    expect(screen.getByText("0/40")).toBeInTheDocument();

    await userEvent.type(note, "abc");

    expect(screen.getByText("3/40")).toBeInTheDocument();
  });

  it("shows a retry button when the lookup fails and retries on click", async () => {
    const refetch = vi.fn();
    vi.mocked(useEducationLookup).mockReturnValue(
      lookupResult({ data: undefined, isError: true, refetch }),
    );

    render(<Harness />);

    expect(
      screen.getByText("Couldn't load class options."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("marks the fieldset busy while the lookup is pending", () => {
    vi.mocked(useEducationLookup).mockReturnValue(
      lookupResult({ data: undefined, isPending: true }),
    );

    const { container } = render(<Harness />);

    expect(container.querySelector("fieldset")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
