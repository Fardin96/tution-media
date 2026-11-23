import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  ZonePlaceSearch,
  type ZonePlace,
} from "@/components/tutor-zones/zone-place-search";
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  type PlacePrediction,
} from "@/lib/places";

vi.mock("@/lib/places", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/places");
  return {
    ...actual,
    fetchPlacePredictions: vi.fn(),
    fetchPlaceDetails: vi.fn(),
  };
});

vi.mock("@/lib/toast", () => ({ toastError: vi.fn() }));

// Parent that feeds the picked address back in, as the zone editor does.
function Parent({ onSelect }: { onSelect: (place: ZonePlace) => void }) {
  const [address, setAddress] = useState<string | null>(null);
  return (
    <ZonePlaceSearch
      id="zone-place"
      address={address}
      onSelect={(place) => {
        setAddress(place.addressText);
        onSelect(place);
      }}
    />
  );
}

// Types a query, picks the one suggestion, and returns what the search reported.
async function pickSuggestion(
  prediction: PlacePrediction,
  formattedAddress: string,
) {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  vi.mocked(fetchPlacePredictions).mockResolvedValue([prediction]);
  vi.mocked(fetchPlaceDetails).mockResolvedValue({
    formattedAddress,
    location: { latitude: 23.7465, longitude: 90.376 },
    district: "Dhaka",
  });
  render(<Parent onSelect={onSelect} />);

  await user.type(screen.getByRole("combobox"), "Dhan");
  vi.advanceTimersByTime(400);
  await waitFor(() => {
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
  await user.click(screen.getByRole("option"));
  await waitFor(() => {
    expect(onSelect).toHaveBeenCalled();
  });
  return { onSelect, input: screen.getByRole("combobox") };
}

describe("ZonePlaceSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the main and secondary text when the suggestion has no description", async () => {
    const { onSelect, input } = await pickSuggestion(
      {
        placeId: "ChIJ456",
        description: "",
        mainText: "Dhanmondi",
        secondaryText: "Dhaka",
      },
      "Dhanmondi, Dhaka, Bangladesh",
    );

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ addressText: "Dhanmondi, Dhaka" }),
    );
    await waitFor(() => {
      expect(input).toHaveValue("Dhanmondi, Dhaka");
    });
  });

  it("falls back to the formatted address when the suggestion has no text", async () => {
    const { onSelect, input } = await pickSuggestion(
      { placeId: "ChIJ789", description: "", mainText: "", secondaryText: "" },
      "Dhanmondi, Dhaka, Bangladesh",
    );

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ addressText: "Dhanmondi, Dhaka, Bangladesh" }),
    );
    await waitFor(() => {
      expect(input).toHaveValue("Dhanmondi, Dhaka, Bangladesh");
    });
  });

  it("keeps the picked suggestion text in the input after the parent updates", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
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
      district: "Dhaka",
    });
    render(<Parent onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "Dhan");
    vi.advanceTimersByTime(400);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option"));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        placeId: "ChIJ123",
        addressText: "Dhanmondi, Dhaka",
        lat: 23.7465,
        lng: 90.376,
      });
    });
    expect(screen.getByRole("combobox")).toHaveValue("Dhanmondi, Dhaka");
  });
});
