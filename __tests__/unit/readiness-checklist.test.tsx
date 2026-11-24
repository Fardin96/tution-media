import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { ReadinessChecklist } from "@/components/profile/readiness-checklist";
import { readReturnTo } from "@/lib/return-to";
import type { TutorRequirement } from "@/lib/tutor-requirements";

// The checklist's links prefetch through the query client, as they do inside the app.
function ReadinessChecklistWithClient(
  props: ComponentProps<typeof ReadinessChecklist>,
) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ReadinessChecklist {...props} />
    </QueryClientProvider>
  );
}

function defaultSet(over: Partial<TutorRequirement>): TutorRequirement {
  return {
    id: "set-1",
    name: "Weekday",
    isDefault: true,
    isActive: true,
    subjectIds: [1],
    teachesOnline: false,
    zoneIds: [],
    ...over,
  } as TutorRequirement;
}

describe("ReadinessChecklist", () => {
  it("lists each missing item with a link to where it is fixed", () => {
    render(
      <ReadinessChecklistWithClient
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
        defaultSet={null}
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
      ["Verify your phone number", "/dashboard#phone-verification"],
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
    render(<ReadinessChecklistWithClient missing={["phone_otp_limit"]} />);

    expect(
      screen.getByRole("link", { name: "Complete your phone otp limit" }),
    ).toHaveAttribute("href", "/dashboard#profile");
  });

  it("renders nothing when nothing is missing", () => {
    const { container } = render(<ReadinessChecklistWithClient missing={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the default set and links to its edit page when it has no zone", () => {
    render(
      <ReadinessChecklistWithClient
        missing={["default_requirement"]}
        defaultSet={defaultSet({})}
      />,
    );

    const link = screen.getByRole("link", {
      name: "Default set “Weekday” needs a zone or online teaching",
    });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/tutor/requirements/set-1/edit",
    );
    expect(link).toHaveAccessibleDescription(
      "Add a teaching zone to it, or turn on “I also teach online”.",
    );
    expect(screen.getByText("1 thing to fix.")).toBeInTheDocument();
  });

  it("lists both gaps when the default set has no subject and no zone", () => {
    render(
      <ReadinessChecklistWithClient
        missing={["default_requirement"]}
        defaultSet={defaultSet({ subjectIds: [] })}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "Default set “Weekday” needs a subject, and a zone or online teaching",
      }),
    ).toBeInTheDocument();
  });

  it("stays general while the sets are not loaded", () => {
    render(
      <ReadinessChecklistWithClient
        missing={["default_requirement", "name"]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Fix your default requirement set" }),
    ).toHaveAttribute("href", "/dashboard/tutor/requirements");
    expect(screen.getByText("2 things to fix.")).toBeInTheDocument();
  });
});

describe("ReadinessChecklist actions and return trip", () => {
  it("renders an action row as a button that calls the action", async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn();
    render(
      <ReadinessChecklistWithClient
        missing={["phone_verification", "name"]}
        actions={{ phone_verification: onVerify }}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Verify your phone number",
    });
    expect(button.tagName).toBe("BUTTON");
    expect(
      within(screen.getByRole("region")).getByRole("link", {
        name: "Add your name",
      }),
    ).toBeInTheDocument();

    await user.click(button);
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it("saves the return trip when a Fix link is followed", async () => {
    const user = userEvent.setup();
    window.sessionStorage.clear();
    render(
      <ReadinessChecklistWithClient
        missing={["name"]}
        returnTo={{
          path: "/dashboard/tutor/packages/new",
          label: "new package",
        }}
      />,
    );
    await user.click(screen.getByRole("link", { name: "Add your name" }));
    expect(readReturnTo()).toMatchObject({
      path: "/dashboard/tutor/packages/new",
      label: "new package",
    });
  });
});
