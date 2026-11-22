import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
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

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    clearTokens: vi.fn(),
    getTokens: vi.fn(() => ({ accessToken: "tok" })),
  },
}));

vi.mock("@/lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile")>()),
  profileApi: {
    hardDeleteMe: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  replace.mockReset();
});

async function openDeleteDialog() {
  render(<DeleteAccountButton />);
  await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
  return screen.getByRole("alertdialog", { name: "Delete your account?" });
}

describe("DeleteAccountButton", () => {
  it("opens a confirmation dialog with Cancel and Delete account", async () => {
    const dialog = await openDeleteDialog();

    expect(
      within(dialog).getByText(/permanently deletes your account/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole("button", { name: "Delete account" }),
    ).toBeInTheDocument();
    expect(profileApi.hardDeleteMe).not.toHaveBeenCalled();
    expect(api.clearTokens).not.toHaveBeenCalled();
  });

  it("offers no soft delete anywhere", async () => {
    await openDeleteDialog();

    expect(screen.queryByText(/soft delete/i)).not.toBeInTheDocument();
  });

  it("closes on Cancel and calls nothing", async () => {
    const dialog = await openDeleteDialog();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(profileApi.hardDeleteMe).not.toHaveBeenCalled();
    expect(api.clearTokens).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("calls profileApi.hardDeleteMe, clears tokens and redirects on confirm", async () => {
    vi.mocked(profileApi.hardDeleteMe).mockResolvedValue(undefined);

    const dialog = await openDeleteDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete account" }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(profileApi.hardDeleteMe).toHaveBeenCalledTimes(1);
    expect(api.clearTokens).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast and keeps the dialog open when deletion fails", async () => {
    vi.mocked(profileApi.hardDeleteMe).mockRejectedValue(
      new Error("Server busy"),
    );

    const dialog = await openDeleteDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete account" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Server busy"),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(api.clearTokens).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", { name: "Delete your account?" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete account",
      }),
    ).toBeEnabled();
  });

  it("shows a blocking status while the account is being deleted", async () => {
    let finish!: () => void;
    vi.mocked(profileApi.hardDeleteMe).mockReturnValue(
      new Promise<undefined>((resolve) => (finish = () => resolve(undefined))),
    );

    const dialog = await openDeleteDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete account" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Deleting your account…",
      ),
    );
    const pendingDialog = screen.getByRole("alertdialog");
    expect(
      within(pendingDialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    expect(replace).not.toHaveBeenCalled();

    await act(async () => finish());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Deleting your account…",
    );
  });
});
