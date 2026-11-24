import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { SettingsPage } from "@/components/admin/settings-page";
import { apiFetch } from "@/lib/api";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  useAdminMe: () => ({ isSuperAdmin: true, isSuccess: true }),
}));

const SAVED_AT = "2026-11-18T05:00:00.000Z";

type Setting = {
  key: string;
  value: number | boolean;
  updatedAt: string | null;
  updatedByName: string | null;
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let settings: Setting[];
/** Requests that fail with this status, keyed by setting. */
let failSave: Record<string, number>;

/**
 * A small settings API: the GET returns the current list, and a PUT stores the value and stamps
 * updatedAt, so the page refetches and its keyed forms remount, as they do in production.
 */
function mockSettingsApi() {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (pathname === "/api/v1/admin/settings") {
      return respond({ settings });
    }
    const match = pathname.match(/^\/api\/v1\/admin\/settings\/([a-z_]+)$/);
    if (match && init?.method === "PUT") {
      const key = match[1];
      if (failSave[key]) {
        return respond({ message: "Server error" }, failSave[key]);
      }
      const body = JSON.parse(init.body as string) as {
        value: number | boolean;
      };
      settings = settings.map((s) =>
        s.key === key
          ? {
              ...s,
              value: body.value,
              updatedAt: SAVED_AT,
              updatedByName: "Ayesha",
            }
          : s,
      );
      return respond(settings.find((s) => s.key === key));
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

async function sectionFor(title: string) {
  const heading = await screen.findByRole("heading", { name: title, level: 2 });
  const section = heading.closest("section");
  if (!section) throw new Error(`${title} section not found`);
  return section;
}

function savedRequests() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => init?.method === "PUT");
}

beforeEach(() => {
  vi.clearAllMocks();
  failSave = {};
  settings = [
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
  ];
  mockSettingsApi();
});

describe("SettingsPage saving a number", () => {
  it("confirms a saved percent even though the save refetches the list", async () => {
    renderPage();
    const user = userEvent.setup();

    const section = await sectionFor("Commission");
    await within(section).findByRole("spinbutton", { name: "Percent" });
    const input = within(section).getByRole("spinbutton", { name: "Percent" });
    await user.clear(input);
    await user.type(input, "12");
    await user.click(within(section).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Setting saved"),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(savedRequests()).toHaveLength(1);
    expect(JSON.parse(savedRequests()[0][1]!.body as string)).toEqual({
      value: 12,
    });
    // The refetched value replaces what was typed.
    await waitFor(() =>
      expect(
        within(
          screen
            .getByRole("heading", { name: "Commission" })
            .closest("section")!,
        ).getByRole("spinbutton", {
          name: "Percent",
        }),
      ).toHaveValue(12),
    );
  });

  it("confirms a saved refund window in days", async () => {
    renderPage();
    const user = userEvent.setup();

    const section = await sectionFor("Refund window");
    await within(section).findByRole("spinbutton", { name: "Days" });
    const input = within(section).getByRole("spinbutton", { name: "Days" });
    await user.clear(input);
    await user.type(input, "14");
    await user.click(within(section).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Setting saved"),
    );
    expect(JSON.parse(savedRequests()[0][1]!.body as string)).toEqual({
      value: 14,
    });
  });

  it("toasts a failed save and keeps the typed value", async () => {
    failSave = { commission_percent: 500 };
    renderPage();
    const user = userEvent.setup();

    const section = await sectionFor("Commission");
    await within(section).findByRole("spinbutton", { name: "Percent" });
    const input = within(section).getByRole("spinbutton", { name: "Percent" });
    await user.clear(input);
    await user.type(input, "12");
    await user.click(within(section).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't save the setting."),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(input).toHaveValue(12);
  });
});
