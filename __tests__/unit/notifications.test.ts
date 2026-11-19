import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  notificationApi,
  notificationHref,
  notificationText,
  relativeTime,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { invalidateNotifications, queryKeys } from "@/lib/query-keys";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Method and path of the nth request the client sent through apiFetch. */
function sent(i: number) {
  const [url, init] = vi.mocked(apiFetch).mock.calls[i];
  return {
    method: init?.method,
    path: new URL(String(url)).pathname,
    search: new URL(String(url)).search,
  };
}

const KINDS: NotificationKind[] = [
  "APPLICATION_RECEIVED",
  "PACKAGE_REQUESTED",
  "APPLICATION_ACCEPTED",
  "APPLICATION_DECLINED",
  "LISTING_FILLED",
  "APPLICATION_WITHDRAWN",
  "APPLICATION_REOPENED",
  "APPLICATION_CANCELLED",
  "APPLICATION_COMPLETED",
  "PACKAGE_UPDATED",
  "PACKAGE_CLOSED",
];

/** Copy from the spec, per kind: [requirement text, package text]. Kinds with one copy repeat it. */
const COPY: Partial<Record<NotificationKind, [string, string]>> = {
  APPLICATION_RECEIVED: [
    "Ana applied to your tuition.",
    "Ana applied to your tuition.",
  ],
  PACKAGE_REQUESTED: [
    "Ana requested your package.",
    "Ana requested your package.",
  ],
  APPLICATION_ACCEPTED: [
    "Ana accepted your application.",
    "Ana accepted your request.",
  ],
  APPLICATION_DECLINED: [
    "Ana declined your application.",
    "Ana declined your request.",
  ],
  LISTING_FILLED: [
    "This tuition hired another tutor.",
    "This package was taken by another student.",
  ],
  APPLICATION_WITHDRAWN: [
    "Ana withdrew their application.",
    "Ana withdrew their request.",
  ],
  APPLICATION_REOPENED: [
    "Ana reopened their application.",
    "Ana reopened their request.",
  ],
  APPLICATION_CANCELLED: [
    "Ana cancelled the tuition.",
    "Ana cancelled the tuition.",
  ],
  APPLICATION_COMPLETED: [
    "Ana marked the tuition as completed.",
    "Ana marked the tuition as completed.",
  ],
  PACKAGE_UPDATED: [
    "Ana updated a package you requested.",
    "Ana updated a package you requested.",
  ],
  PACKAGE_CLOSED: [
    "Ana closed a package you requested.",
    "Ana closed a package you requested.",
  ],
};

/** Upload and moderation alerts: fixed copy that does not depend on the name. */
const FIXED: Partial<Record<NotificationKind, string>> = {
  ID_APPROVED: "Your ID was approved.",
  ID_REJECTED: "Your ID was not accepted. Upload a new one.",
  VIDEO_APPROVED: "Your video was approved.",
  VIDEO_REJECTED: "Your video was not approved.",
  UPLOADS_UNBLOCKED: "You can upload again.",
};

type Fields = Pick<
  AppNotification,
  | "kind"
  | "listingKind"
  | "counterpartName"
  | "filePurpose"
  | "blocksVideos"
  | "blocksDocuments"
>;

function note(
  kind: NotificationKind,
  listingKind: AppNotification["listingKind"],
): Fields {
  return {
    kind,
    listingKind,
    counterpartName: "Ana",
    filePurpose: null,
    blocksVideos: null,
    blocksDocuments: null,
  };
}

describe("notificationText", () => {
  it("covers every kind", () => {
    const ALL_KINDS: NotificationKind[] = [
      ...KINDS,
      "ID_APPROVED",
      "ID_REJECTED",
      "VIDEO_APPROVED",
      "VIDEO_REJECTED",
      "FILE_REMOVED",
      "UPLOADS_BLOCKED",
      "UPLOADS_UNBLOCKED",
    ];
    const covered = [
      ...Object.keys(COPY),
      ...Object.keys(FIXED),
      "FILE_REMOVED",
      "UPLOADS_BLOCKED",
    ];
    expect([...covered].sort()).toEqual([...ALL_KINDS].sort());
  });

  it.each(
    KINDS.flatMap((kind) => [
      [kind, "REQUIREMENT"],
      [kind, "PACKAGE"],
    ]),
  )("%s / %s", (kind, listingKind) => {
    const expected = COPY[kind]?.[listingKind === "PACKAGE" ? 1 : 0] ?? "";
    expect(
      notificationText(
        note(
          kind as NotificationKind,
          listingKind as AppNotification["listingKind"],
        ),
      ),
    ).toBe(expected);
  });

  it.each(Object.entries(FIXED))("%s has fixed copy", (kind, expected) => {
    expect(notificationText({ ...note(kind as NotificationKind, null) })).toBe(
      expected,
    );
  });

  it.each([
    ["STUDENT_ID", "An admin removed your ID."],
    ["TUTOR_ID", "An admin removed your ID."],
    ["CREDENTIAL", "An admin removed your certificate."],
    ["TUTOR_VIDEO", "An admin removed your video."],
    ["BLOG_COVER", "An admin removed your file."],
    [null, "An admin removed your file."],
  ] as const)("FILE_REMOVED for %s", (filePurpose, expected) => {
    expect(
      notificationText({
        ...note("FILE_REMOVED", null),
        filePurpose,
      }),
    ).toBe(expected);
  });

  it.each([
    [true, false, "An admin paused your video uploads."],
    [false, true, "An admin paused your ID and certificate uploads."],
    [true, true, "An admin paused your uploads."],
  ] as const)(
    "UPLOADS_BLOCKED videos=%s documents=%s",
    (blocksVideos, blocksDocuments, expected) => {
      expect(
        notificationText({
          ...note("UPLOADS_BLOCKED", null),
          blocksVideos,
          blocksDocuments,
        }),
      ).toBe(expected);
    },
  );

  it("uses the counterpart name verbatim", () => {
    expect(
      notificationText({
        ...note("APPLICATION_RECEIVED", "REQUIREMENT"),
        counterpartName: "Rafiq Hossain",
      }),
    ).toBe("Rafiq Hossain applied to your tuition.");
  });
});

describe("notificationHref", () => {
  const base = { applicationId: null, filePurpose: null } as const;

  it.each([
    ["APPLICATION_RECEIVED", "app-1", "/dashboard/applications/app-1"],
    ["PACKAGE_CLOSED", "app-2", "/dashboard/applications/app-2"],
    ["APPLICATION_RECEIVED", null, "/dashboard"],
    ["ID_APPROVED", null, "/dashboard#verification"],
    ["ID_REJECTED", null, "/dashboard#verification"],
    ["VIDEO_APPROVED", null, "/dashboard"],
    ["VIDEO_REJECTED", null, "/dashboard"],
    ["UPLOADS_BLOCKED", null, "/dashboard"],
    ["UPLOADS_UNBLOCKED", null, "/dashboard"],
  ] as const)(
    "%s (application %s) leads to %s",
    (kind, applicationId, href) => {
      expect(notificationHref({ ...base, kind, applicationId })).toBe(href);
    },
  );

  it.each([
    ["STUDENT_ID", "/dashboard#verification"],
    ["TUTOR_ID", "/dashboard#verification"],
    ["CREDENTIAL", "/dashboard"],
    ["TUTOR_VIDEO", "/dashboard"],
    ["BLOG_COVER", "/dashboard"],
    [null, "/dashboard"],
  ] as const)("FILE_REMOVED for %s leads to %s", (filePurpose, href) => {
    expect(
      notificationHref({
        kind: "FILE_REMOVED",
        applicationId: null,
        filePurpose,
      }),
    ).toBe(href);
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 10, 16, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it.each([
    ["now", ago(0), "Just now"],
    ["30 seconds ago", ago(30_000), "Just now"],
    ["a future timestamp", new Date(now.getTime() + 10 * MIN), "Just now"],
    ["5 minutes ago", ago(5 * MIN), "5m"],
    ["59 minutes ago", ago(59 * MIN), "59m"],
    ["3 hours ago", ago(3 * HOUR), "3h"],
    ["23 hours ago", ago(23 * HOUR), "23h"],
    ["2 days ago", ago(2 * DAY), "2d"],
    ["6 days ago", ago(6 * DAY), "6d"],
    ["7 days ago", ago(7 * DAY), "9 Nov"],
  ])("%s reads as %s", (_label, date, expected) => {
    expect(relativeTime(date, now)).toBe(expected);
  });

  it("accepts the ISO strings the API sends", () => {
    expect(relativeTime(ago(5 * MIN).toISOString(), now)).toBe("5m");
  });
});

describe("notificationApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the first page with a limit", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      json(200, {
        notifications: [],
        nextCursor: null,
        unreadCount: 0,
      }),
    );
    await notificationApi.list({ limit: 20 });
    expect(sent(0)).toEqual({
      method: "GET",
      path: "/api/v1/notifications",
      search: "?limit=20",
    });
  });

  it("reads the unread count", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, { count: 4 }));
    await expect(notificationApi.unreadCount()).resolves.toEqual({ count: 4 });
    expect(sent(0).path).toBe("/api/v1/notifications/unread-count");
  });

  it("marks one alert read and all alerts read", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 204 }));
    await notificationApi.read("n-1");
    await notificationApi.readAll();
    expect(sent(0)).toMatchObject({
      method: "POST",
      path: "/api/v1/notifications/n-1/read",
    });
    expect(sent(1)).toMatchObject({
      method: "POST",
      path: "/api/v1/notifications/read-all",
    });
  });
});

describe("invalidateNotifications", () => {
  it("invalidates every notifications key", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    await invalidateNotifications(client);
    expect(spy.mock.calls).toEqual([
      [{ queryKey: queryKeys.notifications.all }],
    ]);
    expect(queryKeys.notifications.list.slice(0, 1)).toEqual(
      queryKeys.notifications.all,
    );
    expect(queryKeys.notifications.unreadCount.slice(0, 1)).toEqual(
      queryKeys.notifications.all,
    );
  });
});
