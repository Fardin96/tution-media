import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders the title and body when open", () => {
    render(
      <ConfirmDialog
        open
        title="Remove from your sets too?"
        actions={[]}
        onOpenChange={() => {}}
      >
        <p>{"Physics will also be removed from 'Evening Math'."}</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Remove from your sets too?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Physics will also be removed from 'Evening Math'."),
    ).toBeInTheDocument();
  });

  it("calls onSelect when an action is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Title"
        actions={[{ label: "Remove", variant: "primary", onSelect }]}
        onOpenChange={() => {}}
      >
        Body
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders a danger action as a button and calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Title"
        actions={[{ label: "Delete account", variant: "danger", onSelect }]}
        onOpenChange={() => {}}
      >
        Body
      </ConfirmDialog>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Delete account" }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders an href action as a link", () => {
    render(
      <ConfirmDialog
        open
        title="Title"
        actions={[
          {
            label: "Edit 'Evening Math'",
            href: "/dashboard/tutor/requirements/a/edit",
            onSelect: () => {},
          },
        ]}
        onOpenChange={() => {}}
      >
        Body
      </ConfirmDialog>,
    );
    expect(
      screen.getByRole("link", { name: "Edit 'Evening Math'" }),
    ).toHaveAttribute("href", "/dashboard/tutor/requirements/a/edit");
  });

  it("calls onOpenChange(false) on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Title"
        actions={[{ label: "Cancel", variant: "ghost", onSelect: () => {} }]}
        onOpenChange={onOpenChange}
      >
        Body
      </ConfirmDialog>,
    );
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
