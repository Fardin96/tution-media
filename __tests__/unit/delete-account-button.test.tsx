import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { DeleteAccountButton } from "@/components/auth/delete-account-button";
import { api } from "@/lib/api";
import { profileApi } from "@/lib/profile";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  api: {
    clearTokens: vi.fn(),
    getTokens: vi.fn(() => ({ accessToken: "tok" })),
  },
}));

vi.mock("@/lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile")>()),
  profileApi: {
    deleteMe: vi.fn(),
    hardDeleteMe: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  replace.mockReset();
});

async function openDeleteFlow() {
  render(<DeleteAccountButton />);
  await userEvent.click(
    screen.getByRole("button", { name: /delete account/i }),
  );
}

describe("DeleteAccountButton", () => {
  it("shows soft and hard delete options after the initial click", async () => {
    await openDeleteFlow();

    expect(
      screen.getByRole("button", { name: /soft delete/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hard delete/i }),
    ).toBeInTheDocument();
  });

  it("calls profileApi.deleteMe and redirects on soft delete confirmation", async () => {
    vi.mocked(profileApi.deleteMe).mockResolvedValue(undefined);

    await openDeleteFlow();
    await userEvent.click(screen.getByRole("button", { name: /soft delete/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /confirm soft delete/i }),
    );

    expect(profileApi.deleteMe).toHaveBeenCalledTimes(1);
    expect(profileApi.hardDeleteMe).not.toHaveBeenCalled();
    expect(api.clearTokens).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("calls profileApi.hardDeleteMe and redirects on hard delete confirmation", async () => {
    vi.mocked(profileApi.hardDeleteMe).mockResolvedValue(undefined);

    await openDeleteFlow();
    await userEvent.click(screen.getByRole("button", { name: /hard delete/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /yes, hard delete/i }),
    );

    expect(profileApi.hardDeleteMe).toHaveBeenCalledTimes(1);
    expect(profileApi.deleteMe).not.toHaveBeenCalled();
    expect(api.clearTokens).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows an error toast when deletion fails", async () => {
    vi.mocked(profileApi.deleteMe).mockRejectedValue(new Error("Server busy"));

    await openDeleteFlow();
    await userEvent.click(screen.getByRole("button", { name: /soft delete/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /confirm soft delete/i }),
    );

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Server busy"),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("returns to the option screen from the confirmation screen", async () => {
    await openDeleteFlow();
    await userEvent.click(screen.getByRole("button", { name: /soft delete/i }));
    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(
      screen.getByRole("button", { name: /soft delete/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hard delete/i }),
    ).toBeInTheDocument();
  });
});
