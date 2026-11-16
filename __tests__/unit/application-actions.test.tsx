import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ApplicationActions } from "@/components/applications/application-actions";
import {
  ACTION_META,
  useApplicationAction,
  type ApplicationAction,
} from "@/lib/applications";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/applications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/applications")>();
  return { ...actual, useApplicationAction: vi.fn() };
});

const mutate = vi.fn();

function mockAction(isPending = false) {
  vi.mocked(useApplicationAction).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useApplicationAction>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAction();
});

describe("ApplicationActions", () => {
  it("renders only the allowed actions", () => {
    const allowed: ApplicationAction[] = ["confirm", "reject"];
    render(
      <ApplicationActions applicationId="app-1" allowedActions={allowed} />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      ACTION_META.confirm.label,
      ACTION_META.reject.label,
    ]);
    expect(
      screen.queryByRole("button", { name: ACTION_META.withdraw.label }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when no action is allowed", () => {
    render(<ApplicationActions applicationId="app-1" allowedActions={[]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("runs a non-destructive action at once and reports it", async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());
    render(
      <ApplicationActions applicationId="app-1" allowedActions={["reopen"]} />,
    );

    await user.click(
      screen.getByRole("button", { name: ACTION_META.reopen.label }),
    );

    expect(mutate).toHaveBeenCalledWith(
      { id: "app-1", action: "reopen" },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith(ACTION_META.reopen.done);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("opens a confirm dialog for a destructive action and only acts after confirming", async () => {
    const user = userEvent.setup();
    const meta = ACTION_META.reject.confirm;
    if (!meta) throw new Error("reject should have a confirm step");
    render(
      <ApplicationActions applicationId="app-1" allowedActions={["reject"]} />,
    );

    await user.click(
      screen.getByRole("button", { name: ACTION_META.reject.label }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(meta.title)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: meta.confirmLabel }),
    );

    expect(mutate).toHaveBeenCalledWith(
      { id: "app-1", action: "reject" },
      expect.any(Object),
    );
  });

  it("does not act when the confirm dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationActions
        applicationId="app-1"
        allowedActions={["withdraw"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: ACTION_META.withdraw.label }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(mutate).not.toHaveBeenCalled();
  });

  it("disables every action while a mutation is pending", () => {
    mockAction(true);
    render(
      <ApplicationActions
        applicationId="app-1"
        allowedActions={["confirm", "reject"]}
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
