import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/profile/address-autocomplete";
import type { AddressValue } from "@/components/profile/address-autocomplete";
import { PlaceLookupError } from "@/lib/places";
import type { PlaceDetails, PlacePrediction } from "@/lib/places";
import { SECTIONS, emptyForm, validate } from "@/lib/profile";
import type { ProfileForm } from "@/lib/profile";

vi.mock("@/lib/places", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/places");
  return {
    ...actual,
    fetchPlacePredictions: vi.fn(),
    fetchPlaceDetails: vi.fn(),
    fetchReverseGeocode: vi.fn(),
  };
});

// Counts how often the map mounts, so a test can see that a close keeps it.
const mapMounts = vi.hoisted(() => ({ count: 0 }));

// The app loads the map with next/dynamic; here it renders at once, so the test does not wait on
// a chunk. Hover and focus warm-up still run.
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  const { AddressMap } = await import("@/components/profile/address-map");
  return {
    default: () =>
      function DynamicStub(props: Record<string, unknown>) {
        return React.createElement(AddressMap, props as never);
      },
  };
});

// Stands in for the Google map: one button that drops a pin at a fixed point.
vi.mock("@/components/profile/address-map", async () => {
  const React = await import("react");
  return {
    AddressMap: (props: {
      onPick: (lat: number, lng: number, placeId?: string) => void;
    }) => {
      React.useEffect(() => {
        mapMounts.count += 1;
      }, []);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          { type: "button", onClick: () => props.onPick(23.7465, 90.376) },
          "Pin here",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => props.onPick(23.7465, 90.376, "ChIJ-poi"),
          },
          "Pin POI",
        ),
      );
    },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  fetchReverseGeocode,
} from "@/lib/places";

const emptyValue: AddressValue = {
  address: "",
  placeId: "",
  latitude: null,
  longitude: null,
  district: null,
};

function Wrapper(
  props: Omit<
    React.ComponentProps<typeof AddressAutocomplete>,
    "value" | "onChange"
  >,
) {
  const [value, setValue] = useState<AddressValue>(emptyValue);
  return <AddressAutocomplete {...props} value={value} onChange={setValue} />;
}

function ControlledWrapper({
  onChange,
  initial = emptyValue,
}: {
  onChange: (v: AddressValue) => void;
  initial?: AddressValue;
}) {
  const [value, setValue] = useState<AddressValue>(initial);
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

const FORMATTED = "Dhanmondi, Dhaka, Bangladesh";
const PICK_HINT = "Pick a suggestion to set the location.";

async function pickPlace(
  user: ReturnType<typeof userEvent.setup>,
  district: string | null,
  overrides: Partial<PlacePrediction> = {},
) {
  vi.mocked(fetchPlacePredictions).mockResolvedValue([
    {
      placeId: "ChIJ123",
      description: "Dhanmondi, Dhaka",
      mainText: "Dhanmondi",
      secondaryText: "Dhaka",
      ...overrides,
    },
  ]);
  vi.mocked(fetchPlaceDetails).mockResolvedValue({
    formattedAddress: FORMATTED,
    location: { latitude: 23.7465, longitude: 90.376 },
    district,
  });
  await user.type(screen.getByLabelText("Address"), "Dhan");
  vi.advanceTimersByTime(400);
  await waitFor(() => {
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
  await user.click(screen.getByRole("option"));
}

describe("AddressAutocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    // .env.local sets the browser key; these tests run with no map.
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("debounces suggestions by about 250ms", async () => {
    const user = userEvent.setup();
    render(<Wrapper label="Address" />);
    const input = screen.getByLabelText("Address");
    await user.type(input, "Dhanmondi");
    vi.advanceTimersByTime(100);
    expect(fetchPlacePredictions).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fetchPlacePredictions).toHaveBeenCalledOnce();
  });

  it("drops a late answer for a query the user has already changed", async () => {
    const user = userEvent.setup();
    let resolveSlow!: (results: PlacePrediction[]) => void;
    const slow = new Promise<PlacePrediction[]>((resolve) => {
      resolveSlow = resolve;
    });
    vi.mocked(fetchPlacePredictions)
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce([
        {
          placeId: "mirpur",
          description: "Mirpur, Dhaka",
          mainText: "Mirpur",
          secondaryText: "Dhaka",
        },
      ]);
    render(<Wrapper label="Address" />);
    const input = screen.getByLabelText("Address");

    await user.type(input, "Dhan");
    vi.advanceTimersByTime(400);
    expect(fetchPlacePredictions).toHaveBeenCalledTimes(1);

    await user.type(input, "mon");
    vi.advanceTimersByTime(400);
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /Mirpur/ }),
      ).toBeInTheDocument();
    });

    await act(async () => {
      resolveSlow([
        {
          placeId: "old",
          description: "Dhanmondi, Dhaka",
          mainText: "Dhanmondi",
          secondaryText: "Dhaka",
        },
      ]);
    });
    expect(
      screen.queryByRole("option", { name: /Dhanmondi/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mirpur/ })).toBeInTheDocument();
  });

  it("renders suggestions and selects one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        address: "Dhanmondi, Dhaka",
        placeId: "ChIJ123",
        latitude: 23.7465,
        longitude: 90.376,
        district: "Dhaka",
        source: "place",
      });
    });
  });

  it("keeps the suggestion text, not Google's formatted address", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka");

    await waitFor(() => {
      expect(screen.getByLabelText("Address")).toHaveValue("Dhanmondi, Dhaka");
    });
    expect(screen.getByText("Dhanmondi, Dhaka selected.")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ address: "Dhanmondi, Dhaka" }),
    );
  });

  it("falls back to mainText and secondaryText when the description is empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka", { description: "", mainText: "Mirpur 10" });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ address: "Mirpur 10, Dhaka" }),
      );
    });
  });

  it("falls back to the formatted address when the suggestion has no text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka", {
      description: "",
      mainText: "",
      secondaryText: "",
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ address: FORMATTED }),
      );
    });
  });

  it("selects the active suggestion with Enter using the same label", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    vi.mocked(fetchPlacePredictions).mockResolvedValue([
      {
        placeId: "ChIJ123",
        description: "Dhanmondi, Dhaka",
        mainText: "Dhanmondi",
        secondaryText: "Dhaka",
      },
    ]);
    vi.mocked(fetchPlaceDetails).mockResolvedValue({
      formattedAddress: FORMATTED,
      location: { latitude: 23.7465, longitude: 90.376 },
      district: "Dhaka",
    });
    await user.type(screen.getByLabelText("Address"), "Dhan");
    vi.advanceTimersByTime(400);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          address: "Dhanmondi, Dhaka",
          placeId: "ChIJ123",
        }),
      );
    });
  });

  it("asks for a pick after the text is edited, and not while suggestions are open", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={vi.fn()} />);
    expect(screen.queryByText(PICK_HINT)).not.toBeInTheDocument();

    await pickPlace(user, "Dhaka");
    await waitFor(() => {
      expect(screen.getByLabelText("Address")).toHaveValue("Dhanmondi, Dhaka");
    });
    expect(screen.queryByText(PICK_HINT)).not.toBeInTheDocument();

    // No suggestions come back, so the list stays closed and the hint shows.
    vi.mocked(fetchPlacePredictions).mockResolvedValue([]);
    await user.type(screen.getByLabelText("Address"), "x");
    const hint = await screen.findByText(PICK_HINT);
    expect(screen.getByLabelText("Address")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(hint.id),
    );
  });

  it("keeps the pick hint below the list while suggestions are open", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={vi.fn()} />);
    vi.mocked(fetchPlacePredictions).mockResolvedValue([
      {
        placeId: "ChIJ123",
        description: "Dhanmondi, Dhaka",
        mainText: "Dhanmondi",
        secondaryText: "Dhaka",
      },
    ]);
    await user.type(screen.getByLabelText("Address"), "Dhan");
    vi.advanceTimersByTime(400);
    const listbox = await screen.findByRole("listbox");
    // Hiding the hint while the list opened made the list jump, so it stays and follows the list.
    const hint = screen.getByText(PICK_HINT);
    expect(
      listbox.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("clears district when the address is typed again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka");
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ district: "Dhaka" }),
      ),
    );

    await user.type(screen.getByLabelText("Address"), "x");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ placeId: "", district: null }),
    );
  });

  it("clears district when the address is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka");
    await user.click(
      await screen.findByRole("button", { name: "Clear address" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(emptyValue);
  });

  it("shows a toast when place details fail", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPlacePredictions).mockResolvedValue([
      {
        placeId: "ChIJ999",
        description: "Kolkata, India",
        mainText: "Kolkata",
        secondaryText: "India",
      },
    ]);
    vi.mocked(fetchPlaceDetails).mockRejectedValue(
      new Error("Pick a location in Bangladesh."),
    );
    render(<Wrapper label="Address" />);
    await user.type(screen.getByLabelText("Address"), "Kolk");
    vi.advanceTimersByTime(400);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Pick a location in Bangladesh.",
      );
    });
  });

  it("asks for the district when Google has none", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    expect(screen.queryByLabelText("District")).not.toBeInTheDocument();

    await pickPlace(user, null);
    const district = await screen.findByLabelText("District");
    await user.type(district, "Dhaka");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ placeId: "ChIJ123", district: "Dhaka" }),
    );
    expect(screen.getByLabelText("District")).toHaveValue("Dhaka");
  });

  it("shows no district prompt for a detected district", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={vi.fn()} />);
    await pickPlace(user, "Dhaka");
    await waitFor(() => {
      expect(screen.getByLabelText("Address")).toHaveValue("Dhanmondi, Dhaka");
    });
    expect(screen.queryByLabelText("District")).not.toBeInTheDocument();
  });

  it("shows a saved district by its name rather than its code", () => {
    render(
      <AddressAutocomplete
        label="Address"
        value={{
          address: "House 12, Road 4",
          placeId: "ChIJ9",
          latitude: 23.7,
          longitude: 90.4,
          district: "dhaka",
          districtName: "Dhaka",
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("District: Dhaka")).toBeInTheDocument();
    expect(screen.queryByText("District: dhaka")).not.toBeInTheDocument();
  });

  it("shows the detected district read-only under the address", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={vi.fn()} />);
    await pickPlace(user, "Dhaka");
    const line = await screen.findByText("District: Dhaka");
    expect(screen.getByLabelText("Address")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(line.id),
    );
    expect(screen.queryByLabelText("District")).not.toBeInTheDocument();
  });

  it("warns when the district is outside Dhaka", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={vi.fn()} />);
    await pickPlace(user, "Chattogram");
    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent("We only operate in Dhaka right now.");
    expect(screen.getByLabelText("Address")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(warning.id),
    );
  });

  it("does not warn for Dhaka District", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={vi.fn()} />);
    await pickPlace(user, "Dhaka District");
    await waitFor(() => {
      expect(screen.getByLabelText("Address")).toHaveValue("Dhanmondi, Dhaka");
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

function BusyWrapper({
  onBusyChange,
}: {
  onBusyChange: (busy: boolean) => void;
}) {
  const [value, setValue] = useState<AddressValue>(emptyValue);
  return (
    <AddressAutocomplete
      label="Address"
      value={value}
      onChange={setValue}
      onBusyChange={onBusyChange}
    />
  );
}

describe("AddressAutocomplete busy reporting", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("never reports busy for the typing search", async () => {
    const user = userEvent.setup();
    const onBusyChange = vi.fn();
    vi.mocked(fetchPlacePredictions).mockResolvedValue([]);
    render(<BusyWrapper onBusyChange={onBusyChange} />);

    await user.type(screen.getByLabelText("Address"), "Dhanmondi");
    vi.advanceTimersByTime(400);
    await waitFor(() => expect(fetchPlacePredictions).toHaveBeenCalled());

    expect(onBusyChange).not.toHaveBeenCalledWith(true);
  });

  it("reports a pick as busy, then not busy", async () => {
    const user = userEvent.setup();
    const onBusyChange = vi.fn();
    let resolveDetails!: (details: PlaceDetails) => void;
    vi.mocked(fetchPlacePredictions).mockResolvedValue([
      {
        placeId: "ChIJ123",
        description: "Dhanmondi, Dhaka",
        mainText: "Dhanmondi",
        secondaryText: "Dhaka",
      },
    ]);
    vi.mocked(fetchPlaceDetails).mockReturnValue(
      new Promise<PlaceDetails>((resolve) => {
        resolveDetails = resolve;
      }),
    );
    render(<BusyWrapper onBusyChange={onBusyChange} />);

    await user.type(screen.getByLabelText("Address"), "Dhan");
    vi.advanceTimersByTime(400);
    await user.click(await screen.findByRole("option"));
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      resolveDetails({
        formattedAddress: FORMATTED,
        location: { latitude: 23.7465, longitude: 90.376 },
        district: "Dhaka",
      });
    });
    await waitFor(() => {
      expect(onBusyChange).toHaveBeenLastCalledWith(false);
    });
    expect(onBusyChange.mock.calls.map(([busy]) => busy)).toEqual([
      false,
      true,
      false,
    ]);
  });
});

// The map sits behind a button: open it, then press the stand-in pin.
async function pressPin(
  user: ReturnType<typeof userEvent.setup>,
  openLabel = "Pin on map",
) {
  await user.click(await screen.findByRole("button", { name: openLabel }));
  await user.click(await screen.findByRole("button", { name: "Pin here" }));
}

describe("AddressAutocomplete map pin", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("sets the coordinates at once, then fills the address from the lookup", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(fetchReverseGeocode).mockResolvedValue({
      formattedAddress: "Mirpur 10, Dhaka, Bangladesh",
      placeId: "ChIJ-pin",
      district: "Dhaka",
    });
    render(<ControlledWrapper onChange={onChange} />);

    await pressPin(user);

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        latitude: 23.7465,
        longitude: 90.376,
        placeId: "",
        district: null,
      }),
    );
    expect(fetchReverseGeocode).toHaveBeenCalledWith(
      23.7465,
      90.376,
      undefined,
    );
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        address: "Mirpur 10, Dhaka, Bangladesh",
        placeId: "ChIJ-pin",
        latitude: 23.7465,
        longitude: 90.376,
        district: "Dhaka",
        districtName: null,
        source: "pin",
      });
    });
    expect(screen.queryByText(PICK_HINT)).not.toBeInTheDocument();
  });

  it("sends the placeId of a clicked POI with the pin", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(fetchReverseGeocode).mockResolvedValue({
      formattedAddress: "Dhaka College, Road 2, Dhaka, Bangladesh",
      placeId: "ChIJ-poi",
      district: "Dhaka",
    });
    render(<ControlledWrapper onChange={onChange} />);

    await user.click(await screen.findByRole("button", { name: "Pin on map" }));
    await user.click(await screen.findByRole("button", { name: "Pin POI" }));

    expect(fetchReverseGeocode).toHaveBeenCalledWith(
      23.7465,
      90.376,
      "ChIJ-poi",
    );
    // A POI is Google's place, so the value counts as a place and keeps the id that toPayload sends.
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: "place", placeId: "ChIJ-poi" }),
      );
    });
  });

  it("keeps a POI that Google can't name as the user's pin, which then needs a district", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("No address found here.", 422),
    );
    render(
      <ControlledWrapper
        onChange={onChange}
        initial={{ ...emptyValue, address: "Road 2, Dhaka, Bangladesh" }}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Pin on map" }));
    await user.click(await screen.findByRole("button", { name: "Pin POI" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          source: "pin",
          placeId: "",
          address: "Road 2, Dhaka, Bangladesh",
        }),
      );
    });
    await user.type(await screen.findByLabelText("District"), "Dhaka");

    const form = onChange.mock.lastCall?.[0] as AddressValue;
    expect(form.district).toBe("Dhaka");
    const addressField = SECTIONS.STUDENT.flatMap((s) => s.fields).find(
      (f) => f.key === "address",
    );
    expect(addressField).toBeDefined();
    expect(
      validate([addressField!], {
        ...emptyForm(),
        ...form,
      } as ProfileForm),
    ).toEqual({});
  });

  it("keeps the coordinates and shows the error when no address is found", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("No address found here.", 422),
    );
    render(<ControlledWrapper onChange={onChange} />);

    await pressPin(user);

    // The live region repeats the message, so match the visible line by its id.
    const error = await screen.findByText("No address found here.", {
      selector: "p[id]",
    });
    expect(screen.getByLabelText("Address")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(error.id),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 23.7465,
        longitude: 90.376,
        placeId: "",
      }),
    );
  });

  it("shows the fallback line, not the server text, when Google fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("Couldn't look up that spot. Try again.", 502),
    );
    render(<ControlledWrapper onChange={vi.fn()} />);

    await pressPin(user);

    await screen.findByText(
      "Couldn't find an address there. Try again or type your address.",
      { selector: "p[id]" },
    );
    expect(
      screen.queryByText("Couldn't look up that spot. Try again."),
    ).not.toBeInTheDocument();
  });

  it("keeps the District input while typing after a failed pin lookup", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("No address found here.", 422),
    );
    render(<ControlledWrapper onChange={vi.fn()} />);

    await pressPin(user);
    const district = await screen.findByLabelText("District");
    await user.type(screen.getByLabelText("Address"), "x");

    expect(screen.getByLabelText("District")).toBe(district);
  });

  it("drops a suggestion's address when a pin's lookup fails, keeping the coordinates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka");
    await waitFor(() => {
      expect(screen.getByLabelText("Address")).toHaveValue("Dhanmondi, Dhaka");
    });
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("No address found here.", 422),
    );

    await pressPin(user, "Adjust pin on map");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        address: "",
        placeId: "",
        latitude: 23.7465,
        longitude: 90.376,
        district: null,
        districtName: null,
        source: "pin",
      });
    });
  });

  it("clears the error, but keeps the pin, when the address is typed again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("No address found here.", 422),
    );
    render(<ControlledWrapper onChange={onChange} />);

    await pressPin(user);
    await screen.findByText("No address found here.", { selector: "p[id]" });

    await user.type(screen.getByLabelText("Address"), "x");
    expect(
      screen.queryByText("No address found here.", { selector: "p[id]" }),
    ).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 23.7465,
        longitude: 90.376,
        source: "pin",
      }),
    );
  });

  it("shows a saved pin's district and no pick hint", () => {
    render(
      <AddressAutocomplete
        label="Address"
        value={{
          address: "House 12",
          placeId: "",
          latitude: 23.74,
          longitude: 90.37,
          district: "dhaka",
          districtName: "Dhaka",
          source: "pin",
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("District: Dhaka")).toBeInTheDocument();
    expect(screen.queryByText(/Pick a suggestion/)).not.toBeInTheDocument();
  });

  it("asks for the district when the pin lookup fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("No address found here.", 422),
    );
    render(<ControlledWrapper onChange={vi.fn()} />);

    await pressPin(user);

    expect(await screen.findByLabelText("District")).toBeInTheDocument();
  });

  it("keeps a map pin when the house number is typed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(fetchPlacePredictions).mockResolvedValue([]);
    render(
      <AddressAutocomplete
        label="Address"
        value={{
          address: "House 12",
          placeId: "",
          latitude: 23.74,
          longitude: 90.37,
          district: "dhaka",
          districtName: "Dhaka",
          source: "pin",
        }}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText("Address"), "A");

    expect(onChange).toHaveBeenLastCalledWith({
      address: "House 12A",
      placeId: "",
      latitude: 23.74,
      longitude: 90.37,
      district: "dhaka",
      districtName: "Dhaka",
      source: "pin",
    });
  });

  it("drops a suggestion's details that land after a pin was picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let resolveDetails!: (details: PlaceDetails) => void;
    vi.mocked(fetchPlacePredictions).mockResolvedValue([
      {
        placeId: "ChIJ123",
        description: "Dhanmondi, Dhaka",
        mainText: "Dhanmondi",
        secondaryText: "Dhaka",
      },
    ]);
    vi.mocked(fetchPlaceDetails).mockReturnValue(
      new Promise<PlaceDetails>((resolve) => {
        resolveDetails = resolve;
      }),
    );
    vi.mocked(fetchReverseGeocode).mockResolvedValue({
      formattedAddress: "Mirpur 10, Dhaka, Bangladesh",
      placeId: "ChIJ-pin",
      district: "Dhaka",
    });
    render(<ControlledWrapper onChange={onChange} />);

    await user.type(screen.getByLabelText("Address"), "Dhan");
    vi.advanceTimersByTime(400);
    await user.click(await screen.findByRole("option"));
    await pressPin(user);
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ placeId: "ChIJ-pin" }),
      );
    });

    await act(async () => {
      resolveDetails({
        formattedAddress: FORMATTED,
        location: { latitude: 23.7465, longitude: 90.376 },
        district: "Dhaka",
      });
    });

    expect(
      onChange.mock.calls.some(([next]) => next.placeId === "ChIJ123"),
    ).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ placeId: "ChIJ-pin" }),
    );
  });

  it("offers the map in the pick hint, and keeps it while a suggestion fetch is pending", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPlacePredictions).mockResolvedValue([]);
    render(<ControlledWrapper onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Address"), "Dhan");
    vi.advanceTimersByTime(400);
    await screen.findByText("Pick a suggestion or pin it on the map.");

    vi.mocked(fetchPlacePredictions).mockReturnValue(new Promise(() => {}));
    await user.type(screen.getByLabelText("Address"), "m");
    vi.advanceTimersByTime(400);
    await waitFor(() => expect(fetchPlacePredictions).toHaveBeenCalledTimes(2));
    expect(
      screen.getByText("Pick a suggestion or pin it on the map."),
    ).toBeInTheDocument();
  });

  it("keeps typed text when a pin's lookup fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPlacePredictions).mockResolvedValue([]);
    vi.mocked(fetchReverseGeocode).mockRejectedValue(
      new PlaceLookupError("No address found here.", 422),
    );
    render(<ControlledWrapper onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Address"), "House 12");
    vi.advanceTimersByTime(400);
    await waitFor(() => expect(fetchPlacePredictions).toHaveBeenCalled());
    await pressPin(user);
    await screen.findByText("No address found here.", { selector: "p[id]" });

    expect(screen.getByLabelText("Address")).toHaveValue("House 12");
  });
});

describe("AddressAutocomplete map toggle", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("keeps the map unmounted until the button is pressed", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper onChange={vi.fn()} />);

    const closed = screen.getByRole("button", { name: "Pin on map" });
    expect(closed).toHaveAttribute("aria-expanded", "false");
    expect(closed).not.toHaveAttribute("aria-controls");
    expect(
      screen.queryByRole("button", { name: "Pin here" }),
    ).not.toBeInTheDocument();

    await user.click(closed);

    const pin = await screen.findByRole("button", { name: "Pin here" });
    const open = screen.getByRole("button", { name: "Hide map" });
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(
      document.getElementById(open.getAttribute("aria-controls") ?? ""),
    ).toContainElement(pin);

    await user.click(open);

    expect(screen.getByRole("button", { name: "Pin on map" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("mounts the map once, and keeps it inert while hidden", async () => {
    const user = userEvent.setup();
    mapMounts.count = 0;
    render(<ControlledWrapper onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Pin on map" }));
    await screen.findByRole("button", { name: "Pin here" });
    expect(mapMounts.count).toBe(1);

    await user.click(screen.getByRole("button", { name: "Hide map" }));
    const panel = document.getElementById(
      screen
        .getByRole("button", { name: "Pin on map" })
        .getAttribute("aria-controls") ?? "",
    );
    expect(panel).toHaveAttribute("inert");

    await user.click(screen.getByRole("button", { name: "Pin on map" }));
    expect(panel).not.toHaveAttribute("inert");
    expect(mapMounts.count).toBe(1);
  });

  it("says Adjust pin on map when a pin is already set, and starts closed", () => {
    render(
      <AddressAutocomplete
        label="Address"
        value={{
          address: "House 12",
          placeId: "",
          latitude: 23.74,
          longitude: 90.37,
          district: "dhaka",
          districtName: "Dhaka",
          source: "pin",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Adjust pin on map" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Pin here" }),
    ).not.toBeInTheDocument();
  });

  it("closing the map leaves the value alone", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AddressAutocomplete
        label="Address"
        value={{
          address: "House 12",
          placeId: "",
          latitude: 23.74,
          longitude: 90.37,
          district: "dhaka",
          districtName: "Dhaka",
          source: "pin",
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adjust pin on map" }));
    await user.click(await screen.findByRole("button", { name: "Hide map" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
