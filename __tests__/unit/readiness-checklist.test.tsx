import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ReadinessChecklist } from "@/components/profile/readiness-checklist";

describe("ReadinessChecklist", () => {
  it("lists each missing item with a link to where it is fixed", () => {
    render(
      <ReadinessChecklist
        missing={[
          "name",
          "address",
          "location_pin",
          "area",
          "phone_number",
          "phone_verification",
          "verification",
          "default_requirement",
        ]}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Finish your profile to publish",
    });
    const expected: [string, string][] = [
      ["Add your name", "/dashboard#profile"],
      ["Add your address", "/dashboard#profile"],
      ["Pin your location on the map", "/dashboard#profile"],
      ["Add a teaching area", "/dashboard#profile"],
      ["Add your phone number", "/dashboard#profile"],
      ["Verify your phone number", "/dashboard#profile"],
      ["Get your profile verified", "/dashboard#verification"],
      ["Create a default requirement set", "/dashboard/tutor/requirements/new"],
    ];
    for (const [label, href] of expected) {
      expect(within(region).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(within(region).getAllByRole("listitem")).toHaveLength(8);
  });

  it("falls back to the readable key for an unknown item", () => {
    render(<ReadinessChecklist missing={["phone_otp_limit"]} />);

    expect(
      screen.getByRole("link", { name: "Complete your phone otp limit" }),
    ).toHaveAttribute("href", "/dashboard#profile");
  });

  it("renders nothing when nothing is missing", () => {
    const { container } = render(<ReadinessChecklist missing={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
