import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/profile/address-autocomplete";
import type { AddressValue } from "@/components/profile/address-autocomplete";
import type { PlacePrediction } from "@/lib/places";

vi.mock("@/lib/places", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/places");
  return {
    ...actual,
    fetchPlacePredictions: vi.fn(),
    fetchPlaceDetails: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { fetchPlacePredictions, fetchPlaceDetails } from "@/lib/places";

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
}: {
  onChange: (v: AddressValue) => void;
}) {
  const [value, setValue] = useState<AddressValue>(emptyValue);
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
