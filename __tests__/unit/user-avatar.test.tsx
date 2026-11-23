import { describe, expect, it, vi } from "vitest";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";

const R2 = "https://pub-test.r2.dev/avatars/nadia.webp";
const GOOGLE = "https://lh3.googleusercontent.com/a/picture=s96-c";
// A signed link signed in 2020 for an hour, so it has long expired.
const EXPIRED_SIGNED =
  "https://files.example.r2.cloudflarestorage.com/avatars/nadia.webp?X-Amz-Date=20200101T000000Z&X-Amz-Expires=3600&X-Amz-Signature=old";
// A fresh link, as the refetch would hand back.
const FRESH_SIGNED =
  "https://files.example.r2.cloudflarestorage.com/avatars/nadia.webp?X-Amz-Date=20990101T000000Z&X-Amz-Expires=3600&X-Amz-Signature=new";

function imageOf(container: HTMLElement) {
  return container.querySelector("img");
}

/**
 * Avatars refresh expired photo links through the query client, as on every page, so each
 * render gets one.
 */
function render(ui: ReactElement, client = new QueryClient()) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("UserAvatar", () => {
  it("shows the photo when there is a src", () => {
    const { container } = render(
      <UserAvatar src={R2} name="Nadia Islam" size={44} />,
    );
    expect(imageOf(container)).toHaveAttribute("src", R2);
    expect(screen.queryByText("N")).not.toBeInTheDocument();
  });

  it("shows the first initial when there is no src", () => {
    const { container } = render(
      <UserAvatar src={null} name="  nadia Islam " size={44} />,
    );
    expect(imageOf(container)).toBeNull();
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("shows a placeholder when the name is blank", () => {
    render(<UserAvatar name="" size={44} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("falls back to the initial when the photo fails to load", () => {
    const { container } = render(
      <UserAvatar src={R2} name="Nadia Islam" size={44} />,
    );
    fireEvent.error(imageOf(container)!);
    expect(imageOf(container)).toBeNull();
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("shows initials and refetches when a signed link has expired", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { container, rerender } = render(
      <UserAvatar src={EXPIRED_SIGNED} name="Nadia Islam" size={44} />,
      client,
    );
    fireEvent.error(imageOf(container)!);
    expect(invalidate).toHaveBeenCalledWith({ type: "active" });
    expect(imageOf(container)).toBeNull();
    expect(screen.getByText("N")).toBeInTheDocument();

    // The refetch hands back a new link, which gets its own try.
    rerender(<UserAvatar src={FRESH_SIGNED} name="Nadia Islam" size={44} />);
    expect(imageOf(container)).toHaveAttribute("src", FRESH_SIGNED);
    expect(screen.queryByText("N")).not.toBeInTheDocument();
  });

  it("tries a new photo after one fails", () => {
    const { container, rerender } = render(
      <UserAvatar src={R2} name="Nadia Islam" size={44} />,
    );
    fireEvent.error(imageOf(container)!);
    rerender(
      <UserAvatar
        src="https://pub-test.r2.dev/avatars/new.webp"
        name="Nadia Islam"
        size={44}
      />,
    );
    expect(imageOf(container)).toHaveAttribute(
      "src",
      "https://pub-test.r2.dev/avatars/new.webp",
    );
  });

  it("sends no referrer for a Google picture", () => {
    const { container } = render(
      <UserAvatar src={GOOGLE} name="Nadia Islam" size={44} />,
    );
    const img = imageOf(container);
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(img).toHaveAttribute("src", GOOGLE);
  });

  it("keeps the referrer for an uploaded photo", () => {
    const { container } = render(
      <UserAvatar src={R2} name="Nadia Islam" size={44} />,
    );
    expect(imageOf(container)).not.toHaveAttribute("referrerpolicy");
  });

  it("calls onExpired once when a signed link has expired", () => {
    const onExpired = vi.fn();
    const { container } = render(
      <UserAvatar
        src={EXPIRED_SIGNED}
        name="Nadia Islam"
        size={44}
        onExpired={onExpired}
      />,
    );
    fireEvent.error(imageOf(container)!);
    expect(onExpired).toHaveBeenCalledTimes(1);
    // The broken image is gone, so the same link cannot fail again and call back twice.
    expect(imageOf(container)).toBeNull();
  });

  it("does not call onExpired for a public photo that fails", () => {
    const onExpired = vi.fn();
    const { container } = render(
      <UserAvatar
        src={R2}
        name="Nadia Islam"
        size={44}
        onExpired={onExpired}
      />,
    );
    fireEvent.error(imageOf(container)!);
    expect(onExpired).not.toHaveBeenCalled();
  });
});
