import { describe, it, expect, vi } from "vitest";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { TopBar } from "@/components/profile/profile-dashboard";

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => null,
}));

vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}));

const UPLOAD = "https://pub-test.r2.dev/avatars/nadia.webp";
const GOOGLE = "https://lh3.googleusercontent.com/a/picture=s96-c";

/** The header also holds the logo image, so the avatar is found by its source. */
function avatarSrcs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("img"))
    .map((img) => img.getAttribute("src"))
    .filter((src) => src !== "/assets/ic-demo/Icon-blue.png");
}

/** Avatars refresh expired photo links through the query client, so each render gets one. */
function render(ui: ReactElement) {
  const client = new QueryClient();
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("dashboard TopBar avatar", () => {
  it("shows the uploaded photo rather than the Google picture", () => {
    const { container } = render(
      <TopBar name="Nadia Islam" avatarUrl={UPLOAD} picture={GOOGLE} />,
    );
    expect(avatarSrcs(container)).toEqual([UPLOAD]);
  });

  it("falls back to the Google picture when there is no upload", () => {
    const { container } = render(
      <TopBar name="Nadia Islam" avatarUrl={null} picture={GOOGLE} />,
    );
    expect(avatarSrcs(container)).toEqual([GOOGLE]);
  });

  it("shows the initial when there is no photo at all", () => {
    const { container } = render(
      <TopBar name="Nadia Islam" avatarUrl={null} />,
    );
    expect(avatarSrcs(container)).toEqual([]);
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("asks the dashboard to refetch once when the signed photo link expires", () => {
    const expired =
      "https://files.example.r2.cloudflarestorage.com/avatars/nadia.webp?X-Amz-Date=20200101T000000Z&X-Amz-Expires=3600&X-Amz-Signature=old";
    const onExpired = vi.fn();
    const { container } = render(
      <TopBar name="Nadia Islam" avatarUrl={expired} onExpired={onExpired} />,
    );
    const img = Array.from(container.querySelectorAll("img")).find(
      (el) => el.getAttribute("src") === expired,
    );
    fireEvent.error(img!);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(screen.getByText("N")).toBeInTheDocument();
  });
});
