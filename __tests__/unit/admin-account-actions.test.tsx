import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AccountDetailPage } from "@/components/admin/account-detail-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type { AdminAccountDetail } from "@/lib/admin-accounts";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/accounts/acc-1",
  useRouter: () => ({ replace, push: vi.fn() }),
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

// The landing and public profile refreshes are server actions; they are not under test here.
vi.mock("@/lib/site-content.actions", () => ({
  refreshSiteContent: vi.fn(async () => true),
}));
vi.mock("@/lib/tutor-profile.actions", () => ({
  refreshTutorProfilesAsAdmin: vi.fn(async () => true),
}));

function respond(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function detail(
  overrides: Partial<AdminAccountDetail> = {},
): AdminAccountDetail {
  return {
    id: "acc-1",
    email: "student@example.com",
    role: "STUDENT",
    status: "ACTIVE",
    name: "Rahim Uddin",
    avatarUrl: null,
    phoneNumber: "+8801711000111",
    phoneVerifiedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    lastLoginAt: null,
    deletedAt: null,
    consentVersion: null,
    consentAcceptedAt: null,
    studentId: "stu-1",
    tutorId: null,
    whatsappNumber: null,
    verificationStatus: null,
    isListed: null,
    instituteName: null,
    adminRole: null,
    adminStatus: null,
    activeBlock: null,
    blocks: [],
    counts: { applications: 0, openRequirements: 0, openPackages: 0 },
    ...overrides,
  };
}

function asAdmin({
  isSuperAdmin = false,
  isActive = true,
}: { isSuperAdmin?: boolean; isActive?: boolean } = {}) {
  vi.mocked(useAdminMe).mockReturnValue({
    isSuperAdmin,
    isActive,
    isSuccess: true,
    adminUser: { accountId: "admin-1" },
  } as unknown as ReturnType<typeof useAdminMe>);
}

/** Serves the detail (`after` once a POST has gone through), and records every POST. */
function mockApi(
  account: AdminAccountDetail,
  post: (path: string) => Response = () => respond(account),
  after: AdminAccountDetail = account,
) {
  const posts: { path: string; body: unknown }[] = [];
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (init?.method === "POST") {
      posts.push({ path: pathname, body: JSON.parse(String(init.body)) });
      return post(pathname);
    }
    if (pathname === "/api/v1/admin/accounts/acc-1")
      return respond(posts.length > 0 ? after : account);
    return respond({ message: "Not mocked" }, 404);
  });
  return posts;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccountDetailPage id="acc-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  // A plain admin: every account action is open to any active admin.
  asAdmin();
});

describe("account detail: deactivate and delete", () => {
  it("deactivates with a reason and shows the account as Deactivated", async () => {
    const user = userEvent.setup();
    const deactivated = detail({
      status: "DELETED",
      deletedAt: "2026-11-22T10:00:00.000Z",
    });
    const posts = mockApi(detail(), () => respond(deactivated), deactivated);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Deactivate Rahim Uddin?",
    });
    await user.type(within(dialog).getByLabelText("Reason"), "Asked by email");
    await user.click(
      within(dialog).getByRole("button", { name: "Deactivate" }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Account deactivated"),
    );
    expect(posts).toEqual([
      {
        path: "/api/v1/admin/accounts/acc-1/deactivate",
        body: { reason: "Asked by email" },
      },
    ]);
    expect(
      await screen.findByText(
        "Deactivated. They can come back by signing up again.",
      ),
    ).toBeInTheDocument();
    // The dialog plays its exit before it leaves the DOM.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Deactivate" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("deletes permanently and goes back to the accounts list", async () => {
    const user = userEvent.setup();
    const posts = mockApi(detail(), () => respond(null, 204));
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Delete Rahim Uddin permanently?",
    });
    await user.type(within(dialog).getByLabelText("Reason"), "Spam account");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/dashboard/admin/accounts"),
    );
    expect(toast.success).toHaveBeenCalledWith("Account deleted");
    expect(posts).toEqual([
      {
        path: "/api/v1/admin/accounts/acc-1/hard-delete",
        body: { reason: "Spam account" },
      },
    ]);
  });

  it("a refused delete shows the server's reason and stays on the page", async () => {
    const user = userEvent.setup();
    const message =
      "This account has payment or admin records that must be kept, so it can't be deleted. Block or deactivate it instead.";
    mockApi(detail(), () =>
      respond({ code: "INVALID_ACCOUNT_STATE", message }, 409),
    );
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Spam account");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("asks for a reason before sending anything", async () => {
    const user = userEvent.setup();
    const posts = mockApi(detail());
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Deactivate" }),
    );

    expect(
      await within(dialog).findByText("Write at least 3 characters."),
    ).toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it("a blocked account can be deleted but must be unblocked to deactivate", async () => {
    mockApi(
      detail({
        status: "BLOCKED",
        activeBlock: {
          id: "blk-1",
          reason: "Spam",
          blockedAt: "2026-11-20T00:00:00.000Z",
          blockedByName: "Super",
        },
      }),
    );
    renderPage();

    expect(
      await screen.findByText("Unblock this account to deactivate it."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deactivate" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeInTheDocument();
  });

  it("offers neither action on a super admin's account", async () => {
    mockApi(
      detail({
        role: "ADMIN",
        adminRole: "SUPER_ADMIN",
        adminStatus: "ACTIVE",
        studentId: null,
      }),
    );
    renderPage();

    expect(await screen.findByText("Super admin")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Close this account" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Block account" }),
    ).not.toBeInTheDocument();
  });

  it("a plain admin sees no actions on another admin's account", async () => {
    mockApi(
      detail({
        role: "ADMIN",
        adminRole: "ADMIN",
        adminStatus: "ACTIVE",
        studentId: null,
      }),
    );
    renderPage();

    expect(await screen.findByText("student@example.com")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Close this account" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Block account" }),
    ).not.toBeInTheDocument();
  });

  it("a super admin can block, deactivate and delete a plain admin", async () => {
    asAdmin({ isSuperAdmin: true });
    mockApi(
      detail({
        role: "ADMIN",
        adminRole: "ADMIN",
        adminStatus: "ACTIVE",
        studentId: null,
      }),
    );
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Deactivate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Block account" }),
    ).toBeInTheDocument();
  });

  it("an admin waiting for approval sees no account actions", async () => {
    asAdmin({ isActive: false });
    mockApi(detail());
    renderPage();

    expect(await screen.findByText("student@example.com")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Close this account" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Block account" }),
    ).not.toBeInTheDocument();
  });

  it("a super admin gets the same actions", async () => {
    asAdmin({ isSuperAdmin: true });
    mockApi(detail());
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Deactivate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Block account" }),
    ).toBeInTheDocument();
  });
});

describe("account detail: photo", () => {
  it("shows the account's photo in the header", async () => {
    const PHOTO = "https://pub-test.r2.dev/avatars/rahim.webp";
    mockApi(detail({ avatarUrl: PHOTO }));
    const { container } = renderPage();

    await screen.findByRole("heading", { level: 1, name: "Rahim Uddin" });
    expect(container.querySelector("img")).toHaveAttribute("src", PHOTO);
  });
});
