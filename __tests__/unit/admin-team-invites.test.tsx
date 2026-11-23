import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TeamPage } from "@/components/admin/team-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type { AdminInvite } from "@/lib/admin-team";

const DAY_MS = 86_400_000;
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/team",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  useAdminMe: vi.fn(),
}));

const TEAM_PATH = "/api/v1/admin/admins";
const INVITES_PATH = "/api/v1/admin/admins/invites";

function respond(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function invite(overrides: Partial<AdminInvite> = {}): AdminInvite {
  return {
    id: "inv-1",
    email: "new.admin@example.com",
    invitedByName: "Farabi",
    createdAt: "2026-11-20T00:00:00.000Z",
    expiresAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
    expired: false,
    ...overrides,
  };
}

function asAdmin(isSuperAdmin: boolean) {
  vi.mocked(useAdminMe).mockReturnValue({
    isSuperAdmin,
    isActive: true,
    adminUser: null,
  } as unknown as ReturnType<typeof useAdminMe>);
}

/** Team roster is always empty here; `invites` is the mutable invite list the GET serves. */
function mockApi(
  invites: AdminInvite[],
  onPost: (init?: RequestInit) => Response = () => respond({}, 500),
  onDelete: () => Response = () => new Response(null, { status: 204 }),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (pathname === TEAM_PATH) return respond({ admins: [] });
    if (pathname === INVITES_PATH && init?.method === "POST") {
      return onPost(init);
    }
    if (pathname === INVITES_PATH) return respond({ invites });
    if (pathname.startsWith(`${INVITES_PATH}/`) && init?.method === "DELETE") {
      return onDelete();
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function callsTo(path: string, method: string) {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([input, init]) =>
        init?.method === method &&
        new URL(input, "http://localhost").pathname === path,
    );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TeamPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TeamPage invites", () => {
  it("hides the Invites section and never calls the invites route for a non-super admin", async () => {
    asAdmin(false);
    mockApi([invite()]);
    renderPage();

    await screen.findByText("No admins yet.");
    expect(
      screen.queryByRole("heading", { name: "Invites" }),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(
          ([input]) =>
            new URL(input, "http://localhost").pathname === INVITES_PATH,
        ),
    ).toBe(false);
  });

  it("sends the invite and shows the new row", async () => {
    asAdmin(true);
    const created = invite({ id: "inv-2", email: "tutor.admin@example.com" });
    const invites: AdminInvite[] = [];
    mockApi(invites, () => {
      invites.push(created);
      return respond(created, 201);
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No open invites.");
    await user.type(
      screen.getByLabelText("Email"),
      "  tutor.admin@example.com  ",
    );
    await user.click(screen.getByRole("button", { name: "Add invite" }));

    expect(await screen.findByText("tutor.admin@example.com")).toBeVisible();
    expect(toast.success).toHaveBeenCalledWith(
      "Invite added. Copy the sign-in link and send it to them.",
    );
    const posts = callsTo(INVITES_PATH, "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({
      email: "tutor.admin@example.com",
    });
  });

  it("shows ACCOUNT_EXISTS on the email field", async () => {
    asAdmin(true);
    mockApi([], () =>
      respond(
        {
          error: "AccountExists",
          code: "ACCOUNT_EXISTS",
          message: "already has an account",
        },
        409,
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No open invites.");
    const field = screen.getByLabelText("Email");
    await user.type(field, "student@example.com");
    await user.click(screen.getByRole("button", { name: "Add invite" }));

    expect(
      await screen.findByText(
        "This email already has an account, so it can't be invited.",
      ),
    ).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveFocus();
  });

  it("asks before revoking and calls DELETE for the chosen invite", async () => {
    asAdmin(true);
    mockApi([invite()]);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Revoke for new.admin@example.com",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Revoke the invite for new.admin@example.com?"),
    ).toBeInTheDocument();
    expect(callsTo(`${INVITES_PATH}/inv-1`, "DELETE")).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(callsTo(`${INVITES_PATH}/inv-1`, "DELETE")).toHaveLength(1),
    );
  });

  it("shows INVITE_EXISTS on the email field with the admin wording", async () => {
    asAdmin(true);
    mockApi([], () =>
      respond(
        { error: "InviteExists", code: "INVITE_EXISTS", message: "exists" },
        409,
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No open invites.");
    const field = screen.getByLabelText("Email");
    await user.type(field, "new.admin@example.com");
    await user.click(screen.getByRole("button", { name: "Add invite" }));

    expect(
      await screen.findByText("This email already has an open invite."),
    ).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows SUPER_ADMIN_EMAIL on the email field", async () => {
    asAdmin(true);
    mockApi([], () =>
      respond(
        {
          error: "SuperAdminEmail",
          code: "SUPER_ADMIN_EMAIL",
          message: "super",
        },
        409,
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No open invites.");
    const field = screen.getByLabelText("Email");
    await user.type(field, "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Add invite" }));

    expect(
      await screen.findByText(
        "This email belongs to a super admin. They can sign in without an invite.",
      ),
    ).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("checks the email locally and sends nothing when it is malformed", async () => {
    asAdmin(true);
    mockApi([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No open invites.");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Add invite" }));

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
    expect(callsTo(INVITES_PATH, "POST")).toHaveLength(0);
  });

  it.each([
    [429, "RATE_LIMITED", "Too many requests. Wait a minute and try again."],
    [
      500,
      "INTERNAL_ERROR",
      "Something went wrong on our side. Try again in a moment.",
    ],
  ])(
    "sends a %i on add to a toast, not the email field",
    async (status, code, message) => {
      asAdmin(true);
      mockApi([], () =>
        respond({ error: code, code, message: "server" }, status),
      );
      const user = userEvent.setup();
      renderPage();

      await screen.findByText("No open invites.");
      const field = screen.getByLabelText("Email");
      await user.type(field, "tutor.admin@example.com");
      await user.click(screen.getByRole("button", { name: "Add invite" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      expect(field).not.toHaveAttribute("aria-invalid");
      expect(field).toHaveValue("tutor.admin@example.com");
    },
  );

  it("shows an expired invite with a pill and Invite again, and renews it with the same email", async () => {
    asAdmin(true);
    const expired = invite({
      id: "inv-old",
      email: "late.admin@example.com",
      expired: false,
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    mockApi([expired], () => respond(expired, 201));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Expired")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: /Copy sign-in link/,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Invite again for late.admin@example.com",
      }),
    );

    await waitFor(() => expect(callsTo(INVITES_PATH, "POST")).toHaveLength(1));
    const posts = callsTo(INVITES_PATH, "POST");
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({
      email: "late.admin@example.com",
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Invite renewed. Copy the sign-in link and send it to them.",
      ),
    );
  });

  it("copies the admin sign-in URL for an open invite", async () => {
    asAdmin(true);
    mockApi([invite()]);
    const user = userEvent.setup();
    renderPage();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await user.click(
      await screen.findByRole("button", {
        name: "Copy sign-in link for new.admin@example.com",
      }),
    );

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/sign-in`);
  });

  it("closes the dialog, removes the row and returns focus to the email field after a revoke", async () => {
    asAdmin(true);
    const invites: AdminInvite[] = [invite()];
    mockApi(invites, undefined, () => {
      invites.length = 0;
      return new Response(null, { status: 204 });
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Revoke for new.admin@example.com",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

    expect(await screen.findByText("No open invites.")).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("new.admin@example.com")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("closes the dialog with a toast when the invite was already revoked (404)", async () => {
    asAdmin(true);
    mockApi([invite()], undefined, () =>
      respond({ error: "NotFound", code: "NOT_FOUND", message: "gone" }, 404),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Revoke for new.admin@example.com",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(toast.error).toHaveBeenCalledWith(
      "This invite was already used or revoked.",
    );
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("shows the 14-day window at most, using the fetch time", async () => {
    asAdmin(true);
    const createdAt = new Date().toISOString();
    mockApi([
      invite({
        createdAt,
        expiresAt: new Date(Date.parse(createdAt) + 14 * DAY_MS).toISOString(),
      }),
    ]);
    renderPage();

    expect(await screen.findByText(/Expires in 14 days/)).toBeVisible();
  });
});
