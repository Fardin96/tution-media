import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogoutButton } from "@/components/auth/logout-button";
import { api } from "@/lib/api";
import { client } from "@/lib/api-client";
import { signOut } from "@/lib/auth.server";

vi.mock("@/lib/auth.server", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  client: { POST: vi.fn() },
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    clearTokens: vi.fn(),
    getTokens: vi.fn(() => ({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getTokens).mockReturnValue({
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });
});

async function openLogoutDialog() {
  render(<LogoutButton />);
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  return screen.getByRole("alertdialog");
}

describe("LogoutButton", () => {
  it("opens a confirmation dialog without logging out", async () => {
    const dialog = await openLogoutDialog();

    expect(
      within(dialog).getByRole("heading", { name: "Log out?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "You'll need to sign in again to see your dashboard.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(client.POST).not.toHaveBeenCalled();
    expect(api.clearTokens).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("closes the dialog on Cancel without logging out", async () => {
    const dialog = await openLogoutDialog();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(client.POST).not.toHaveBeenCalled();
    expect(api.clearTokens).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("closes the dialog on Escape without logging out", async () => {
    const dialog = await openLogoutDialog();

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(client.POST).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("revokes the refresh token, clears tokens and signs out on confirm", async () => {
    vi.mocked(client.POST).mockResolvedValue({} as never);

    const dialog = await openLogoutDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Log out" }),
    );

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(client.POST).toHaveBeenCalledWith("/api/v1/auth/logout", {
      body: { refreshToken: "refresh-token" },
    });
    expect(api.clearTokens).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("shows a blocking status while logging out", async () => {
    let finishRevoke!: (value: unknown) => void;
    vi.mocked(client.POST).mockReturnValue(
      new Promise((resolve) => (finishRevoke = resolve)) as never,
    );

    const dialog = await openLogoutDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Log out" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Logging out…"),
    );
    const pendingDialog = screen.getByRole("alertdialog");
    const confirm = within(pendingDialog).getByRole("button", {
      name: "Log out",
    });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(
      within(pendingDialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    expect(signOut).not.toHaveBeenCalled();

    await act(async () => finishRevoke({}));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).not.toHaveTextContent("Logging out…");
  });
});
