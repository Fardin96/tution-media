import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetSubjectPicker } from "@/components/tutor-requirements/set-subject-picker";
import { searchSubjects, type Option } from "@/lib/profile";

const SUBJECT_OPTIONS = [
  "Bangla",
  "English",
  "Mathematics",
  "Higher Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "ICT",
  "Accounting",
  "Finance",
  "Economics",
  "General Science",
  "Religion",
  "Arabic",
].map((name, i) => ({ id: i + 1, name }));

vi.mock("@/lib/subjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subjects")>()),
  useSubjects: () => ({ subjects: SUBJECT_OPTIONS }),
}));

vi.mock("@/lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile")>()),
  searchSubjects: vi.fn(),
}));

const PROFILE: Option[] = [
  { id: 1, name: "Math" },
  { id: 2, name: "English" },
];
const ALL: Option[] = [...PROFILE, { id: 10, name: "Physics" }];

// Keeps the selection in state so the row and tokens update like they do in the form.
function Harness({
  initial,
  profileSubjects,
  onChange,
}: {
  initial: number[];
  profileSubjects: Option[];
  onChange: (ids: number[]) => void;
}) {
  const [ids, setIds] = useState(initial);
  return (
    <SetSubjectPicker
      idPrefix="test"
      profileSubjects={profileSubjects}
      value={ids}
      onChange={(next) => {
        onChange(next);
        setIds(next);
      }}
    />
  );
}

function renderPicker(
  value: number[] = [],
  profileSubjects: Option[] = PROFILE,
) {
  const onChange = vi.fn();
  render(
    <Harness
      initial={value}
      profileSubjects={profileSubjects}
      onChange={onChange}
    />,
  );
  return { onChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchSubjects).mockImplementation(async (query: string) => {
    const q = query.trim().toLowerCase();
    return q ? ALL.filter((s) => s.name.toLowerCase().includes(q)) : ALL;
  });
});

describe("SetSubjectPicker", () => {
  it("shows selected subjects as tokens with a remove button", async () => {
    renderPicker([1, 10]);

    expect(
      await screen.findByRole("button", { name: "Remove Physics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Math" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Add another",
    );
  });

  it("adds a profile suggestion to the end of the field and removes it from the row", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker([10]);

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(onChange).toHaveBeenCalledWith([10, 2]);
    expect(
      screen.queryByRole("button", { name: "English" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Math" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("hides the profile row when every profile subject is selected", () => {
    renderPicker([1, 2]);

    expect(screen.queryByText("From your profile")).not.toBeInTheDocument();
  });

  it("removes a subject with its × button", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker([1, 10]);

    await user.click(
      await screen.findByRole("button", { name: "Remove Physics" }),
    );

    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it("removes the last token on Backspace in an empty input", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker([1, 10]);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it("adds the first search result on Enter", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    const input = screen.getByRole("combobox");
    await user.type(input, "Phy");

    expect(
      await screen.findByRole("option", { name: "Physics" }),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith([10]);
  });

  it("adds a clicked search result and keeps focus in the input", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.type(screen.getByRole("combobox"), "Phy");
    await user.click(await screen.findByRole("option", { name: "Physics" }));

    expect(onChange).toHaveBeenCalledWith([10]);
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("says a non-profile subject is also added to the profile", async () => {
    renderPicker([10]);

    expect(
      await screen.findByText("Also adds Physics to your profile subjects."),
    ).toBeInTheDocument();
  });

  it("does not show the profile note when only profile subjects are selected", () => {
    renderPicker([1]);

    expect(screen.queryByText(/Also adds/)).not.toBeInTheDocument();
  });
});
