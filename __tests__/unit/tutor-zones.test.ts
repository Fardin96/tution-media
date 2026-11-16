import { describe, expect, it } from "vitest";
import {
  emptyZoneForm,
  formatRadius,
  fromZone,
  toCreateZonePayload,
  toZonePatch,
  validateZoneForm,
  type TutorZone,
  type ZoneForm,
} from "@/lib/tutor-zones";

const DHAKA = { lat: 23.8103, lng: 90.4125 };

function validForm(overrides: Partial<ZoneForm> = {}): ZoneForm {
  return {
    label: "Dhanmondi",
    lat: DHAKA.lat,
    lng: DHAKA.lng,
    radiusM: 2000,
    placeId: null,
    addressText: null,
    ...overrides,
  };
}

function zone(overrides: Partial<TutorZone> = {}): TutorZone {
  return {
    id: "z1",
    label: "Dhanmondi",
    lat: 23.745123,
    lng: 90.375456,
    radiusM: 2000,
    placeId: "place-1",
    addressText: "Road 27, Dhaka",
    requirementIds: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateZoneForm", () => {
  it("accepts a complete form inside Bangladesh", () => {
    expect(validateZoneForm(validForm())).toEqual({});
  });

  it("asks for a pin when neither a place nor a map pick is set", () => {
    const errors = validateZoneForm(validForm({ lat: null, lng: null }));
    expect(errors.lat).toBe("Search for a place or drop a pin on the map.");
  });

  it("rejects a pin outside Bangladesh", () => {
    const errors = validateZoneForm(validForm({ lat: 40.7, lng: -74 }));
    expect(errors.lat).toBe("Pick a spot inside Bangladesh.");
  });

  it("rejects a radius below 1 km or above 5 km", () => {
    const message = "Pick a radius between 1 and 5 km.";
    expect(validateZoneForm(validForm({ radiusM: 999 })).radiusM).toBe(message);
    expect(validateZoneForm(validForm({ radiusM: 5001 })).radiusM).toBe(
      message,
    );
  });

  it("rejects a radius that is not a whole number of metres", () => {
    expect(validateZoneForm(validForm({ radiusM: 1500.5 })).radiusM).toBe(
      "Pick a radius between 1 and 5 km.",
    );
  });

  it("accepts the radius bounds themselves", () => {
    expect(validateZoneForm(validForm({ radiusM: 1000 }))).toEqual({});
    expect(validateZoneForm(validForm({ radiusM: 5000 }))).toEqual({});
  });

  it("requires a name after trimming", () => {
    expect(validateZoneForm(validForm({ label: "   " })).label).toBe(
      "Give this zone a name.",
    );
  });

  it("rejects a name longer than LABEL_MAX", () => {
    expect(validateZoneForm(validForm({ label: "x".repeat(61) })).label).toBe(
      "Keep the name under 60 characters.",
    );
  });
});

describe("toCreateZonePayload", () => {
  it("rounds coordinates to six decimals and trims the label", () => {
    const payload = toCreateZonePayload(
      validForm({
        label: "  Dhanmondi  ",
        lat: 23.81034567891,
        lng: 90.41251234567,
      }),
    );
    expect(payload.label).toBe("Dhanmondi");
    expect(payload.lat).toBe(23.810346);
    expect(payload.lng).toBe(90.412512);
    expect(payload.radiusM).toBe(2000);
  });

  it("omits placeId and addressText when they are not set", () => {
    const payload = toCreateZonePayload(
      validForm({ placeId: null, addressText: null }),
    );
    expect(payload).not.toHaveProperty("placeId");
    expect(payload).not.toHaveProperty("addressText");
  });

  it("omits addressText when it is only whitespace", () => {
    const payload = toCreateZonePayload(
      validForm({ placeId: "p1", addressText: "   " }),
    );
    expect(payload.placeId).toBe("p1");
    expect(payload).not.toHaveProperty("addressText");
  });

  it("includes placeId and trimmed addressText when set", () => {
    const payload = toCreateZonePayload(
      validForm({ placeId: "p1", addressText: "  Road 27  " }),
    );
    expect(payload.placeId).toBe("p1");
    expect(payload.addressText).toBe("Road 27");
  });
});

describe("toZonePatch", () => {
  it("is empty when nothing changed", () => {
    const original = zone();
    expect(toZonePatch(original, fromZone(original))).toEqual({});
  });

  it("is empty when the label only differs by surrounding spaces", () => {
    const original = zone();
    const form = { ...fromZone(original), label: "  Dhanmondi  " };
    expect(toZonePatch(original, form)).toEqual({});
  });

  it("sends lat and lng together when only one coordinate moves", () => {
    const original = zone();
    const patch = toZonePatch(original, {
      ...fromZone(original),
      lat: 23.9,
    });
    expect(patch.lat).toBe(23.9);
    expect(patch.lng).toBe(original.lng);
  });

  it("sends only the fields that changed", () => {
    const original = zone();
    expect(
      toZonePatch(original, { ...fromZone(original), radiusM: 3000 }),
    ).toEqual({ radiusM: 3000 });
  });

  it("sends null for addressText when it is cleared", () => {
    const original = zone();
    const patch = toZonePatch(original, {
      ...fromZone(original),
      addressText: "",
    });
    expect(patch).toEqual({ addressText: null });
  });

  it("sends null for placeId when the place is removed", () => {
    const original = zone();
    const patch = toZonePatch(original, {
      ...fromZone(original),
      placeId: null,
    });
    expect(patch).toEqual({ placeId: null });
  });

  it("uses the trimmed label when it changed", () => {
    const original = zone();
    const patch = toZonePatch(original, {
      ...fromZone(original),
      label: " Gulshan ",
    });
    expect(patch).toEqual({ label: "Gulshan" });
  });
});

describe("formatRadius", () => {
  it("shows whole kilometres without decimals", () => {
    expect(formatRadius(1000)).toBe("1 km");
  });

  it("shows one decimal when the trailing zero is dropped", () => {
    expect(formatRadius(2500)).toBe("2.5 km");
  });

  it("shows two decimals when needed", () => {
    expect(formatRadius(1250)).toBe("1.25 km");
  });
});

describe("emptyZoneForm", () => {
  it("starts with no pin and the default radius", () => {
    const form = emptyZoneForm();
    expect(form.lat).toBeNull();
    expect(form.lng).toBeNull();
    expect(form.radiusM).toBe(2000);
  });
});
