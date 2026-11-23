import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { AccountsPage } from "@/components/admin/accounts-page";
import {
  useAdminAccounts,
  type AdminAccountSummary,
} from "@/lib/admin-accounts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/admin-accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-accounts")>()),
  useAdminAccounts: vi.fn(),
}));

const PHOTO = "https://pub-test.r2.dev/avatars/nadia.webp";

function account(
  overrides: Partial<AdminAccountSummary> = {},
): AdminAccountSummary {
  return {
    id: "acc_1",
    email: "nadia@example.com",
    role: "STUDENT",
    status: "ACTIVE",
    name: "Nadia Islam",
    phoneNumber: null,
    phoneVerifiedAt: null,
    avatarUrl: null,
    createdAt: "2026-11-10T04:00:00.000Z",
    lastLoginAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function mockAccounts(rows: AdminAccountSummary[]) {
  vi.mocked(useAdminAccounts).mockReturnValue({
    data: { pages: [{ accounts: rows, nextCursor: null }] },
    isPending: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminAccounts>);
}

beforeEach(() => {
  vi.mocked(useAdminAccounts).mockReset();
});

/** Avatars refresh expired photo links through the query client, so each render gets one. */
function render(ui: ReactElement) {
  const client = new QueryClient();
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("AccountsPage rows", () => {
  it("shows each account's photo beside the name", () => {
    mockAccounts([account({ avatarUrl: PHOTO })]);
    const { container } = render(<AccountsPage />);

    const row = screen.getByRole("link", { name: /Nadia Islam/ });
    expect(row).toContainElement(container.querySelector("img"));
    expect(container.querySelector("img")).toHaveAttribute("src", PHOTO);
  });

  it("shows the initial of the email when there is no name or photo", () => {
    mockAccounts([
      account({ id: "acc_2", name: null, email: "new@example.com" }),
    ]);
    render(<AccountsPage />);

    const row = screen.getByRole("link", { name: /No profile yet/ });
    expect(within(row).getByText("N")).toBeInTheDocument();
    expect(row.querySelector("img")).toBeNull();
  });
});
