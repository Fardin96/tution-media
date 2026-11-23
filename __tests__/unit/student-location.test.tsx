import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudentLocation } from "@/components/applications/student-location";
import { directionsUrl } from "@/components/applications/format";

vi.mock("@vis.gl/react-google-maps", async () => {
  const React = await import("react");
  return {
    APIProvider: (props: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    Map: (props: { children?: React.ReactNode }) =>
      React.createElement("div", null, props.children),
    AdvancedMarker: () => null,
  };
});

const WITH_PIN = {
  address: "House 12, Road 5, Dhanmondi, Dhaka, Bangladesh",
  lat: 23.7465,
  lng: 90.376,
  placeId: "ChIJ-home",
};

describe("directionsUrl", () => {
  it("uses the coordinates and the place id when both are set", () => {
    expect(directionsUrl(WITH_PIN)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=23.7465,90.376&destination_place_id=ChIJ-home",
    );
  });

  it("uses only the coordinates when there is no place id", () => {
    expect(directionsUrl({ ...WITH_PIN, placeId: null })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=23.7465,90.376",
    );
  });

  it("adds the encoded place id to the address when there are no coordinates", () => {
    expect(
      directionsUrl({
        address: "Mirpur 10, Dhaka",
        lat: null,
        lng: null,
        placeId: "ChIJ-mirpur",
      }),
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Mirpur%2010%2C%20Dhaka&destination_place_id=ChIJ-mirpur",
    );
  });

  it("falls back to the encoded address without coordinates", () => {
    expect(
      directionsUrl({
        address: "House 12, Road 5, Dhanmondi",
        lat: null,
        lng: null,
        placeId: null,
      }),
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=House%2012%2C%20Road%205%2C%20Dhanmondi",
    );
  });
});

describe("StudentLocation", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the address and a directions link that opens in a new tab", () => {
    render(<StudentLocation location={WITH_PIN} />);

    expect(screen.getByText(WITH_PIN.address)).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "Get directions (opens Google Maps)",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=23.7465,90.376&destination_place_id=ChIJ-home",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("min-h-11");
    expect(link).toHaveClass("justify-self-start");
  });

  it("renders no map toggle without the browser key", () => {
    render(<StudentLocation location={WITH_PIN} />);

    expect(
      screen.queryByRole("button", { name: "Show on map" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Student's location map" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the map closed until the toggle is pressed", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    render(<StudentLocation location={WITH_PIN} />);

    const toggle = screen.getByRole("button", { name: "Show on map" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).not.toHaveAttribute("aria-controls");
    expect(
      screen.queryByRole("region", { name: "Student's location map" }),
    ).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Hide map");
    expect(
      await screen.findByRole("region", { name: "Student's location map" }),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-controls");
  });

  it("says the exact pin is missing and sends directions by address", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    render(
      <StudentLocation
        location={{
          address: "Mirpur 10, Dhaka",
          lat: null,
          lng: null,
          placeId: null,
        }}
      />,
    );

    expect(
      screen.getByText(
        "The exact pin isn't available, so directions use the address.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show on map" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Get directions (opens Google Maps)" }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=Mirpur%2010%2C%20Dhaka",
    );
  });

  it("adds the place id to the address link when there is no pin", () => {
    render(
      <StudentLocation
        location={{
          address: "Mirpur 10, Dhaka",
          lat: null,
          lng: null,
          placeId: "ChIJ-mirpur",
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Get directions (opens Google Maps)" }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=Mirpur%2010%2C%20Dhaka&destination_place_id=ChIJ-mirpur",
    );
  });
});
