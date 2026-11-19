import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { apiFetch } from "@/lib/api";
import type { AppNotification } from "@/lib/notifications";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

// Radix popper measures its content; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const NOW = new Date().toISOString();

function alert(
  id: string,
  over: Partial<AppNotification> = {},
): AppNotification {
  return {
    id,
    kind: "APPLICATION_RECEIVED",
    applicationId: `app-${id}`,
    listingKind: "REQUIREMENT",
    counterpartName: "Ana",
    note: null,
    filePurpose: null,
    blocksVideos: null,
    blocksDocuments: null,
    readAt: null,
    createdAt: NOW,
    ...over,
  };
}

/**
 * A small fake server behind apiFetch. Read endpoints mutate `state`, so the
 * unread count after a refetch matches what the server would now say.
 */
let state: { notifications: AppNotification[]; listFails: boolean };

const unread = () => state.notifications.filter((n) => !n.readAt).length;

function mockApi(notifications: AppNotification[]) {
  state = { notifications, listFails: false };
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;

    if (method === "GET" && path === "/api/v1/notifications/unread-count")
      return json(200, { count: unread() });

    if (method === "GET" && path === "/api/v1/notifications") {
      if (state.listFails)
        return json(500, { error: "InternalError", message: "boom" });
      return json(200, {
        notifications: state.notifications,
        nextCursor: null,
        unreadCount: unread(),
      });
    }

    if (method === "POST" && path === "/api/v1/notifications/read-all") {
      const at = new Date().toISOString();
      state.notifications = state.notifications.map((n) => ({
        ...n,
        readAt: n.readAt ?? at,
      }));
      return new Response(null, { status: 204 });
    }

    const read = path.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
    if (method === "POST" && read) {
      const at = new Date().toISOString();
      state.notifications = state.notifications.map((n) =>
        n.id === read[1] ? { ...n, readAt: n.readAt ?? at } : n,
      );
      return new Response(null, { status: 204 });
    }

    return json(404, { error: "NotFound", message: "not mocked" });
  });
}

function sentRequests() {
  return vi.mocked(apiFetch).mock.calls.map(([input, init]) => ({
    method: (init?.method ?? "GET").toUpperCase(),
    path: new URL(String(input)).pathname,
  }));
}

function renderBell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: /^Notifications/ });

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the unread count on the badge and in the label", async () => {
    mockApi([alert("1"), alert("2"), alert("3", { readAt: NOW })]);
    renderBell();

    expect(
      await screen.findByRole("button", { name: "Notifications, 2 unread" }),
    ).toBeInTheDocument();
    expect(trigger()).toHaveTextContent("2");
  });

  it('caps the badge at "9+"', async () => {
    mockApi(Array.from({ length: 12 }, (_, i) => alert(`n${i}`)));
    renderBell();

    expect(
      await screen.findByRole("button", { name: "Notifications, 12 unread" }),
    ).toHaveTextContent("9+");
  });

  it("shows 9 exactly as 9", async () => {
    mockApi(Array.from({ length: 9 }, (_, i) => alert(`n${i}`)));
    renderBell();

    expect(
      await screen.findByRole("button", { name: "Notifications, 9 unread" }),
    ).toHaveTextContent(/^9$/);
  });

  it("hides the badge at zero and keeps the plain label", async () => {
    mockApi([alert("1", { readAt: NOW })]);
    renderBell();

    await waitFor(() =>
      expect(sentRequests()).toContainEqual({
        method: "GET",
        path: "/api/v1/notifications/unread-count",
      }),
    );
    expect(trigger()).toHaveAccessibleName("Notifications");
    expect(
      trigger().querySelector("[aria-hidden='true'].rounded-full"),
    ).toBeNull();
    expect(trigger()).not.toHaveTextContent(/\d/);
  });

  it("opens a list with unread alerts marked and relative times", async () => {
    mockApi([
      alert("1", { counterpartName: "Ana" }),
      alert("2", {
        kind: "APPLICATION_ACCEPTED",
        counterpartName: "Rafiq",
        readAt: NOW,
      }),
    ]);
    const user = userEvent.setup();
    renderBell();
    await screen.findByRole("button", { name: "Notifications, 1 unread" });

    await user.click(trigger());

    const dialog = await screen.findByRole("dialog", { name: "Notifications" });
    expect(
      within(dialog).getByText("Ana applied to your tuition."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Rafiq accepted your application."),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText("Just now")).toHaveLength(2);
    expect(within(dialog).getByText("Unread:")).toBeInTheDocument();
  });

  it("clicking an item marks it read, closes and links to the application", async () => {
    mockApi([alert("1", { applicationId: "app-42" })]);
    const user = userEvent.setup();
    renderBell();
    await screen.findByRole("button", { name: "Notifications, 1 unread" });
    await user.click(trigger());

    const link = await screen.findByRole("link", {
      name: /Ana applied to your tuition/,
    });
    await user.click(link);

    expect(link).toHaveAttribute("href", "/dashboard/applications/app-42");
    expect(sentRequests()).toContainEqual({
      method: "POST",
      path: "/api/v1/notifications/1/read",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(trigger()).toHaveAccessibleName("Notifications"),
    );
  });

  it("does not mark an already read alert read again", async () => {
    mockApi([
      alert("1", { kind: "APPLICATION_ACCEPTED", readAt: NOW }),
      alert("2"),
    ]);
    const user = userEvent.setup();
    renderBell();
    await screen.findByRole("button", { name: "Notifications, 1 unread" });
    await user.click(trigger());

    await user.click(await screen.findByRole("link", { name: /Ana accepted/ }));

    expect(sentRequests().filter((r) => r.path.endsWith("/read"))).toHaveLength(
      0,
    );
  });

  it('"Mark all as read" calls read-all and clears the badge', async () => {
    mockApi([alert("1"), alert("2")]);
    const user = userEvent.setup();
    renderBell();
    await screen.findByRole("button", { name: "Notifications, 2 unread" });
    await user.click(trigger());

    await user.click(
      await screen.findByRole("button", { name: "Mark all as read" }),
    );

    expect(sentRequests()).toContainEqual({
      method: "POST",
      path: "/api/v1/notifications/read-all",
    });
    await waitFor(() =>
      expect(trigger()).toHaveAccessibleName("Notifications"),
    );
    expect(
      screen.queryByRole("button", { name: "Mark all as read" }),
    ).not.toBeInTheDocument();
  });

  it('hides "Mark all as read" when nothing is unread', async () => {
    mockApi([alert("1", { readAt: NOW })]);
    const user = userEvent.setup();
    renderBell();
    await waitFor(() =>
      expect(sentRequests()).toContainEqual({
        method: "GET",
        path: "/api/v1/notifications/unread-count",
      }),
    );
    await user.click(trigger());

    await screen.findByText("Ana applied to your tuition.");
    expect(
      screen.queryByRole("button", { name: "Mark all as read" }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no alerts", async () => {
    mockApi([]);
    const user = userEvent.setup();
    renderBell();
    await user.click(trigger());

    expect(await screen.findByText("Nothing new yet.")).toBeInTheDocument();
  });

  it("shows an error with a retry that refetches the list", async () => {
    mockApi([alert("1")]);
    state.listFails = true;
    const user = userEvent.setup();
    renderBell();
    await user.click(trigger());

    expect(
      await screen.findByText("Couldn't load notifications."),
    ).toBeInTheDocument();

    state.listFails = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText("Ana applied to your tuition."),
    ).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    mockApi([]);
    const user = userEvent.setup();
    renderBell();
    await user.click(trigger());
    await screen.findByText("Nothing new yet.");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});

describe("NotificationBell notes and upload alerts", () => {
  it("shows the admin note under the alert text", async () => {
    mockApi([
      alert("1", {
        kind: "ID_REJECTED",
        applicationId: null,
        note: "Photo is blurred.",
      }),
    ]);
    renderBell();
    await userEvent.click(trigger());
    expect(
      await screen.findByText("Your ID was not accepted. Upload a new one."),
    ).toBeInTheDocument();
    expect(screen.getByText("Note: Photo is blurred.")).toBeInTheDocument();
  });

  it("leads an ID alert to the verification card", async () => {
    mockApi([alert("2", { kind: "ID_APPROVED", applicationId: null })]);
    renderBell();
    await userEvent.click(trigger());
    const link = await screen.findByRole("link", {
      name: /Your ID was approved\./,
    });
    expect(link).toHaveAttribute("href", "/dashboard#verification");
  });
});
