import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditSection } from "@/components/profile/edit-section";
import { ApiError, emptyForm, SECTIONS } from "@/lib/profile";

vi.mock("@/lib/areas", () => ({ useAreas: () => ({ areas: [] }) }));
vi.mock("@/lib/subjects", () => ({ useSubjects: () => ({ subjects: [] }) }));

const identity = SECTIONS.TUTOR[0];

describe("EditSection saving a tutor's institute", () => {
  it("puts a rejected institutionId on the institute field instead of a toast", async () => {
    const onSave = vi.fn().mockRejectedValue(
      new ApiError("Validation failed", 400, {
        code: "VALIDATION_ERROR",
        issues: [
          {
            path: ["body", "institutionId"],
            message: "Pick a school or university from the list.",
          },
        ],
      }),
    );
    render(
      <EditSection
        section={identity}
        values={{
          ...emptyForm("Nusrat"),
          gender: "FEMALE",
          studentIdNumber: "1805123",
          instituteName: "Old school",
          institutionId: 7,
        }}
        onSave={onSave}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Edit\s*about you/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(
      await screen.findByText("Pick a school or university from the list."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("University or college")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
