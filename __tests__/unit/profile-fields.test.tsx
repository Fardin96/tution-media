import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileFields } from "@/components/profile/profile-fields";
import { SECTIONS, emptyForm } from "@/lib/profile";

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
