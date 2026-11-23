import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountDetailPage } from "@/components/admin/account-detail-page";
import { AccountsPage } from "@/components/admin/accounts-page";
import { apiFetch } from "@/lib/api";
import { formatDateTime, useAdminMe } from "@/lib/admin";
import type {
  AdminAccountDetail,
  AdminAccountSummary,
} from "@/lib/admin-accounts";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/accounts",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const VERIFIED_AT = "2026-11-10T08:30:00.000Z";

function detail(overrides: Partial<AdminAccountDetail>): AdminAccountDetail {
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

function summary(overrides: Partial<AdminAccountSummary>): AdminAccountSummary {
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
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useAdminMe).mockReturnValue({
    isSuperAdmin: false,
    isSuccess: true,
    adminUser: { accountId: "admin-1" },
  } as unknown as ReturnType<typeof useAdminMe>);
});

describe("admin account phone verification marker", () => {
  it("detail page shows the verified date next to a verified phone", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input) => {
      const { pathname } = new URL(input, "http://localhost");
      if (pathname === "/api/v1/admin/accounts/acc-1")
        return respond(detail({ phoneVerifiedAt: VERIFIED_AT }));
      return respond({ message: "Not mocked" }, 404);
    });

    renderWithClient(<AccountDetailPage id="acc-1" />);

    expect(
      await screen.findByText(`Verified ${formatDateTime(VERIFIED_AT)}`),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not verified")).not.toBeInTheDocument();
  });

  it("detail page shows Not verified for an unverified tutor phone", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input) => {
      const { pathname } = new URL(input, "http://localhost");
      if (pathname === "/api/v1/admin/accounts/acc-2")
        return respond(
          detail({
            id: "acc-2",
            role: "TUTOR",
            tutorId: "tut-1",
            studentId: null,
            phoneVerifiedAt: null,
          }),
        );
      return respond({ message: "Not mocked" }, 404);
    });

    renderWithClient(<AccountDetailPage id="acc-2" />);

    expect(await screen.findByText("Not verified")).toBeInTheDocument();
    expect(screen.queryByText(/^Verified /)).not.toBeInTheDocument();
  });

  it("list shows a short marker only for accounts with a phone number", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input) => {
      const { pathname } = new URL(input, "http://localhost");
      if (pathname === "/api/v1/admin/accounts")
        return respond({
          accounts: [
            summary({
              id: "acc-1",
              name: "Verified One",
              phoneVerifiedAt: VERIFIED_AT,
            }),
            summary({
              id: "acc-2",
              name: "Unverified Two",
              phoneVerifiedAt: null,
            }),
            summary({
              id: "acc-3",
              name: null,
              phoneNumber: null,
              phoneVerifiedAt: null,
            }),
          ],
          nextCursor: null,
        });
      return respond({ message: "Not mocked" }, 404);
    });

    renderWithClient(<AccountsPage />);

    await waitFor(() =>
      expect(screen.getByText("Verified One")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Verified")).toHaveLength(1);
    expect(screen.getAllByText("Not verified")).toHaveLength(1);
    expect(screen.getByText("No phone number")).toBeInTheDocument();
  });
});
