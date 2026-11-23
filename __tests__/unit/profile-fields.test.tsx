import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileFields } from "@/components/profile/profile-fields";
import { emptyForm, SECTIONS, type FieldDef } from "@/lib/profile";
import { fetchPlaceDetails, fetchPlacePredictions } from "@/lib/places";

vi.mock("@/lib/places", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/places")>()),
  fetchPlacePredictions: vi.fn(),
  fetchPlaceDetails: vi.fn(),
}));

const addressField: FieldDef = {
  key: "address",
  kind: "address",
  label: "Address",
};

// Saved as Dhaka with a name; picks a place in `district` and returns the last patch sent.
async function pickPlaceIn(district: string) {
  const onChange = vi.fn();
  vi.mocked(fetchPlacePredictions).mockResolvedValue([
    {
      placeId: "ChIJ9",
      description: "Gazipur Sadar, Gazipur",
      mainText: "Gazipur Sadar",
      secondaryText: "Gazipur",
    },
  ]);
  vi.mocked(fetchPlaceDetails).mockResolvedValue({
    formattedAddress: "Gazipur, Bangladesh",
    location: { latitude: 23.99, longitude: 90.41 },
    district,
  });
  render(
    <ProfileFields
      fields={[addressField]}
      form={{
        ...emptyForm("Rahim"),
        district: "Dhaka",
        districtName: "Dhaka North",
      }}
      errors={{}}
      onChange={onChange}
    />,
  );

  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Gazipur" },
  });
  await waitFor(() => {
    expect(screen.getByRole("option")).toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole("option"));
  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ district }),
    );
  });
  return onChange;
}

describe("ProfileFields address district name", () => {
  it("clears the saved district name when a pick lands in a different district", async () => {
    const onChange = await pickPlaceIn("Chattogram");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ district: "Chattogram", districtName: null }),
    );
  });

  it("keeps the saved district name when the pick is in the same district", async () => {
    const onChange = await pickPlaceIn("Dhaka");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        district: "Dhaka",
        districtName: "Dhaka North",
      }),
    );
  });
});

describe("ProfileFields institute field", () => {
  it("renders the institute before the student ID for tutors", () => {
    render(
      <ProfileFields
        fields={SECTIONS.TUTOR[0].fields}
        form={emptyForm("Nusrat")}
        errors={{}}
        onChange={() => {}}
      />,
    );

    const institute = screen.getByLabelText("University or college");
    const studentId = screen.getByLabelText("University student ID");
    expect(
      institute.compareDocumentPosition(studentId) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(institute).toHaveAttribute("maxlength", "120");
    expect(institute).toHaveAttribute("placeholder", "University of Dhaka");
    expect(institute).toHaveAttribute("autocomplete", "organization");
    expect(institute).toHaveAttribute("name", "instituteName");
    expect(institute).toHaveAccessibleDescription(
      "Students see this on your profile.",
    );
  });

  it("does not render the institute for students", () => {
    render(
      <ProfileFields
        fields={SECTIONS.STUDENT[0].fields}
        form={emptyForm("Rahim")}
        errors={{}}
        onChange={() => {}}
      />,
    );

    expect(
      screen.queryByLabelText("University or college"),
    ).not.toBeInTheDocument();
  });
});
