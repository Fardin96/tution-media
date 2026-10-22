import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AddressAutocomplete } from "@/components/profile/address-autocomplete";
import type { AddressValue } from "@/components/profile/address-autocomplete";

vi.mock("@/lib/places", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/places");
  return {
    ...actual,
    fetchPlacePredictions: vi.fn(),
    fetchPlaceDetails: vi.fn(),
  };
});

import { fetchPlacePredictions, fetchPlaceDetails } from "@/lib/places";

function Wrapper(
  props: Omit<
    React.ComponentProps<typeof AddressAutocomplete>,
    "value" | "onChange"
  >,
) {
  const [value, setValue] = useState<AddressValue>({
    address: "",
    placeId: "",
    latitude: null,
    longitude: null,
  });
  return <AddressAutocomplete {...props} value={value} onChange={setValue} />;
}

describe("AddressAutocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not search until 3 characters are typed", async () => {
    const user = userEvent.setup();
    render(<Wrapper label="Address" />);
    const input = screen.getByLabelText("Address");
    await user.type(input, "Dh");
    vi.advanceTimersByTime(400);
    expect(fetchPlacePredictions).not.toHaveBeenCalled();
    await user.type(input, "a");
    vi.advanceTimersByTime(400);
    expect(fetchPlacePredictions).toHaveBeenCalledOnce();
  });

  it("debounces at 300ms", async () => {
    const user = userEvent.setup();
    render(<Wrapper label="Address" />);
    const input = screen.getByLabelText("Address");
    await user.type(input, "Dhanmondi");
    vi.advanceTimersByTime(250);
    expect(fetchPlacePredictions).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fetchPlacePredictions).toHaveBeenCalledOnce();
  });

  it("renders suggestions and selects one", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPlacePredictions).mockResolvedValue([
      {
        placeId: "ChIJ123",
        description: "Dhanmondi, Dhaka",
        mainText: "Dhanmondi",
        secondaryText: "Dhaka",
      },
    ]);
    vi.mocked(fetchPlaceDetails).mockResolvedValue({
      formattedAddress: "Dhanmondi, Dhaka, Bangladesh",
      location: { latitude: 23.7465, longitude: 90.376 },
    });

    const onChange = vi.fn();
    function ControlledWrapper() {
      const [value, setValue] = useState<AddressValue>({
        address: "",
        placeId: "",
        latitude: null,
        longitude: null,
      });
      return (
        <AddressAutocomplete
          label="Address"
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }

    render(<ControlledWrapper />);

    const input = screen.getByLabelText("Address");
    await user.type(input, "Dhan");
    vi.advanceTimersByTime(400);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option"));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        address: "Dhanmondi, Dhaka, Bangladesh",
        placeId: "ChIJ123",
        latitude: 23.7465,
        longitude: 90.376,
      });
    });
  });
});
