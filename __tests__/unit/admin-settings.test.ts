import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "@/components/admin/settings-page";
import { validateCommission, validatePercent } from "@/lib/admin-settings";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  useAdminMe: () => ({ isSuperAdmin: true, isSuccess: true }),
}));

vi.mock("@/lib/admin-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-settings")>()),
  useAdminSettings: () => ({
    data: {
      settings: [
        {
          key: "commission_percent",
          value: 10,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "online_payments_enabled",
          value: true,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "gateway_charge_percent",
          value: 2.5,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "require_tutor_verification",
          value: false,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "require_phone_verification",
          value: true,
          updatedAt: null,
          updatedByName: null,
        },
      ],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdateSetting: () => ({ mutate: mocks.mutate, isPending: false }),
}));

describe("validateCommission", () => {
  it.each(["0", "5", "12.5", "99.99", "100", "100.00", " 7 ", ".5", "5."])(
    "accepts %j",
    (text) => {
      expect(validateCommission(text)).toBeUndefined();
    },
  );

  it.each(["", "   ", "abc", "-1", "101", "100.01", "1e2"])(
    "asks for a number from 0 to 100 for %j",
    (text) => {
      expect(validateCommission(text)).toBe("Enter a number from 0 to 100.");
    },
  );

  it("allows at most two decimal places", () => {
    expect(validateCommission("1.234")).toBe("Use at most 2 decimal places.");
    expect(validateCommission("0.001")).toBe("Use at most 2 decimal places.");
  });
});

describe("validatePercent with max 10", () => {
  it("accepts up to 10 with at most two decimals", () => {
    expect(validatePercent("10", 10)).toBeUndefined();
    expect(validatePercent("2.5", 10)).toBeUndefined();
  });

  it("rejects values above 10 with the max in the message", () => {
    expect(validatePercent("10.5", 10)).toBe("Enter a number from 0 to 10.");
    expect(validatePercent("11", 10)).toBe("Enter a number from 0 to 10.");
  });

  it("rejects a third decimal place", () => {
    expect(validatePercent("2.555", 10)).toBe("Use at most 2 decimal places.");
  });
});

describe("SettingsPage", () => {
  beforeEach(() => {
    mocks.mutate.mockClear();
  });

  it("renders the online payments and processing charge sections after commission", () => {
    render(createElement(SettingsPage));

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Commission",
      "Online payments",
      "Processing charge",
      "Tutor verification",
      "Phone verification",
    ]);
  });

  it("rejects a processing charge above 10 without saving", async () => {
    const user = userEvent.setup();
    render(createElement(SettingsPage));

    const section = screen
      .getByRole("heading", { name: "Processing charge" })
      .closest("section");
    if (!section) throw new Error("Processing charge section not found");

    const input = within(section).getByRole("spinbutton", { name: "Percent" });
    await user.clear(input);
    await user.type(input, "11");
    await user.click(within(section).getByRole("button", { name: "Save" }));

    expect(
      within(section).getByText("Enter a number from 0 to 10."),
    ).toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
