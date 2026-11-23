import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressMap } from "@/components/profile/address-map";

// The Google map is replaced by one button whose click reports a fixed point.
const click = vi.hoisted(() => ({
  point: { lat: 23.7, lng: 90.4 },
  placeId: null as string | null,
  stop: undefined as (() => void) | undefined,
}));

vi.mock("@vis.gl/react-google-maps", async () => {
  const React = await import("react");
  return {
    APIProvider: (props: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    Map: (props: {
      onClick: (event: unknown) => void;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        "div",
        null,
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () =>
              props.onClick({
                detail: { latLng: click.point, placeId: click.placeId },
                stop: click.stop,
              }),
          },
          "Map",
        ),
        props.children,
      ),
    AdvancedMarker: (props: { onDragEnd?: (event: unknown) => void }) =>
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            props.onDragEnd?.({
              latLng: {
                lat: () => click.point.lat,
                lng: () => click.point.lng,
              },
            }),
        },
        "Drag pin",
      ),
    useMap: () => null,
  };
});

describe("AddressMap", () => {
  beforeEach(() => {
    click.point = { lat: 23.7, lng: 90.4 };
    click.placeId = null;
    click.stop = undefined;
  });

  it("stops the POI click and passes its placeId", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const stop = vi.fn();
    click.point = { lat: 23.7465, lng: 90.376 };
    click.placeId = "ChIJ-poi";
    click.stop = stop;
    render(
      <AddressMap
        apiKey="test-key"
        latitude={null}
        longitude={null}
        onPick={onPick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Map" }));

    expect(stop).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith(23.7465, 90.376, "ChIJ-poi");
  });

  it("does not stop a plain click", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const stop = vi.fn();
    click.point = { lat: 23.7465, lng: 90.376 };
    click.stop = stop;
    render(
      <AddressMap
        apiKey="test-key"
        latitude={null}
        longitude={null}
        onPick={onPick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Map" }));

    expect(stop).not.toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith(23.7465, 90.376, undefined);
  });

  it("labels the region and points it at the hint", () => {
    render(
      <AddressMap
        apiKey="test-key"
        latitude={null}
        longitude={null}
        onPick={vi.fn()}
        describedById="hint-1"
      />,
    );
    const region = screen.getByRole("region", { name: "Address pin map" });
    expect(region).toHaveAttribute("aria-describedby", "hint-1");
  });

  it("picks a click inside Bangladesh", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onOutside = vi.fn();
    click.point = { lat: 23.7465, lng: 90.376 };
    render(
      <AddressMap
        apiKey="test-key"
        latitude={null}
        longitude={null}
        onPick={onPick}
        onOutside={onOutside}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Map" }));

    expect(onPick).toHaveBeenCalledWith(23.7465, 90.376, undefined);
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("reports a click outside Bangladesh and does not pick it", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onOutside = vi.fn();
    click.point = { lat: 30, lng: 90.4 };
    render(
      <AddressMap
        apiKey="test-key"
        latitude={null}
        longitude={null}
        onPick={onPick}
        onOutside={onOutside}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Map" }));

    expect(onOutside).toHaveBeenCalledOnce();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("reports a drag outside Bangladesh and does not pick it", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onOutside = vi.fn();
    click.point = { lat: 30, lng: 90.4 };
    render(
      <AddressMap
        apiKey="test-key"
        latitude={23.7}
        longitude={90.4}
        onPick={onPick}
        onOutside={onOutside}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Drag pin" }));

    expect(onOutside).toHaveBeenCalledOnce();
    expect(onPick).not.toHaveBeenCalled();
  });
});
