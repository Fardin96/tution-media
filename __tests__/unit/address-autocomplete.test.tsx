import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { toast } from "sonner";
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

async function pickPlace(
  user: ReturnType<typeof userEvent.setup>,
  district: string | null,
) {
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
    const onChange = vi.fn();
    render(<ControlledWrapper onChange={onChange} />);
    await pickPlace(user, "Dhaka");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        address: "Dhanmondi, Dhaka, Bangladesh",
        placeId: "ChIJ123",
        latitude: 23.7465,
        longitude: 90.376,
        district: "Dhaka",
      });
    });
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
      expect(screen.getByLabelText("Address")).toHaveValue(
        "Dhanmondi, Dhaka, Bangladesh",
      );
    });
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
      expect(screen.getByLabelText("Address")).toHaveValue(
        "Dhanmondi, Dhaka, Bangladesh",
      );
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
