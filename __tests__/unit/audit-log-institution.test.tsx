import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuditLogPage } from "@/components/admin/audit-log-page";
import { actionLabel } from "@/lib/admin-audit";

const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/admin-audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-audit")>()),
  useAuditLog: () => ({
    data: { pages: [{ entries: [] }] },
    isPending: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

describe("audit log for schools and universities", () => {
  it("has a filter chip for the institution entity", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuditLogPage />
      </QueryClientProvider>,
    );
    const group = screen.getByRole("group", { name: "Entity type" });
    const chip = within(group).getByRole("button", {
      name: "Schools and universities",
    });
    chip.click();
    expect(replace).toHaveBeenCalledWith(
      "/dashboard/admin/audit-log?entityType=institution",
      { scroll: false },
    );
  });

  it("labels the institution actions like the subject ones", () => {
    expect(actionLabel("institution.create")).toBe(
      "Added a school or university",
    );
    expect(actionLabel("institution.update")).toBe(
      "Changed a school or university",
    );
  });
});
