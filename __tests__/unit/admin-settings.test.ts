import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "@/components/admin/settings-page";
import {
  validateCommission,
  validateCount,
  validateDays,
  validatePercent,
} from "@/lib/admin-settings";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(() => Promise.resolve()),
}));

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
          key: "refund_window_days",
          value: 7,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "daily_application_limit",
          value: 50,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "daily_package_request_limit",
          value: 20,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "daily_accept_limit",
          value: 20,
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
          key: "require_tutor_phone_verification",
          value: true,
          updatedAt: null,
          updatedByName: null,
        },
        {
          key: "require_student_phone_verification",
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
  useUpdateSetting: () => ({
    mutate: mocks.mutate,
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
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

describe("validateDays", () => {
  it.each(["0", "7", "30", "90", " 14 ", "007"])("accepts %j", (text) => {
    expect(validateDays(text, 90)).toBeUndefined();
  });

  it.each(["", "   ", "1.5", "-1", "abc", "1e2", "2 days"])(
    "asks for a whole number of days for %j",
    (text) => {
      expect(validateDays(text, 90)).toBe("Enter a whole number of days.");
    },
  );

  it("asks for 0 to 90 days", () => {
    expect(validateDays("91", 90)).toBe("Use 0 to 90 days.");
    expect(validateDays("100", 90)).toBe("Use 0 to 90 days.");
  });
});

describe("validateCount", () => {
  it.each(["1", "50", " 20 ", "1000"])("accepts %j", (text) => {
    expect(validateCount(text, 1000)).toBeUndefined();
  });

  it.each(["", "   ", "1.5", "-1", "abc", "1e2", "5 times"])(
    "asks for a whole number for %j",
    (text) => {
      expect(validateCount(text, 1000)).toBe("Enter a whole number.");
    },
  );

  it.each(["0", "00", "1001"])("asks for 1 to 1000 for %j", (text) => {
    expect(validateCount(text, 1000)).toBe("Use 1 to 1000.");
  });
});

describe("SettingsPage", () => {
  beforeEach(() => {
    mocks.mutate.mockClear();
    mocks.mutateAsync.mockClear();
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
      "Refund window",
      "Daily applications",
      "Daily package requests",
      "Daily accepts",
      "Tutor verification",
      "Tutor phone verification",
      "Student phone verification",
    ]);
  });

  it("saves a refund window in whole days", async () => {
    const user = userEvent.setup();
    render(createElement(SettingsPage));

    const section = screen
      .getByRole("heading", { name: "Refund window" })
      .closest("section");
    if (!section) throw new Error("Refund window section not found");

    const input = within(section).getByRole("spinbutton", { name: "Days" });
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(
      within(section).getByText(
        "Days after an online payment that a tutor can ask for a refund. 0 turns tutor requests off.",
      ),
    ).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "14");
    await user.click(within(section).getByRole("button", { name: "Save" }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      key: "refund_window_days",
      value: 14,
    });
  });

  it("rejects a refund window above 90 days without saving", async () => {
    const user = userEvent.setup();
    render(createElement(SettingsPage));

    const section = screen
      .getByRole("heading", { name: "Refund window" })
      .closest("section");
    if (!section) throw new Error("Refund window section not found");

    const input = within(section).getByRole("spinbutton", { name: "Days" });
    await user.clear(input);
    await user.type(input, "91");
    await user.click(within(section).getByRole("button", { name: "Save" }));

    expect(within(section).getByText("Use 0 to 90 days.")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
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
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
});
