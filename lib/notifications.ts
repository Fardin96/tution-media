import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { invalidateNotifications, queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AppNotification = Schemas["AppNotification"];
export type NotificationKind = AppNotification["kind"];
export type NotificationPage = Schemas["NotificationPage"];
export type UnreadCount = Schemas["UnreadCount"];

const DROPDOWN_LIMIT = 20;
const UNREAD_POLL_MS = 60_000;

export const notificationApi = {
  list: (q: { cursor?: string; limit?: number }) =>
    unwrap(client.GET("/api/v1/notifications", { params: { query: q } })),
  unreadCount: () => unwrap(client.GET("/api/v1/notifications/unread-count")),
  read: (id: string) =>
    unwrap(
      client.POST("/api/v1/notifications/{id}/read", {
        params: { path: { id } },
      }),
    ),
  readAll: () => unwrap(client.POST("/api/v1/notifications/read-all")),
};

/** Polls every minute and on window focus, so the bell stays current without a socket. */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => notificationApi.unreadCount(),
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Fetched only while the dropdown is open; staleTime 0 so each opening shows fresh alerts. */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: () => notificationApi.list({ limit: DROPDOWN_LIMIT }),
    enabled,
    staleTime: 0,
  });
}

/** Optimistic: the count and list update at once and roll back if the request fails. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiError,
    string,
    {
      count?: UnreadCount;
      page?: NotificationPage;
    }
  >({
    mutationFn: (id) => notificationApi.read(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });
      const count = queryClient.getQueryData<UnreadCount>(
        queryKeys.notifications.unreadCount,
      );
      const page = queryClient.getQueryData<NotificationPage>(
        queryKeys.notifications.list,
      );
      const target = page?.notifications.find((n) => n.id === id);
      if (!target || target.readAt) return {};
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationPage>(
        queryKeys.notifications.list,
        (old) =>
          old && {
            ...old,
            notifications: old.notifications.map((n) =>
              n.id === id ? { ...n, readAt } : n,
            ),
          },
      );
      queryClient.setQueryData<UnreadCount>(
        queryKeys.notifications.unreadCount,
        (old) => old && { count: Math.max(0, old.count - 1) },
      );
      return { count, page };
    },
    onError: (_err, _id, context) => {
      if (context?.count)
        queryClient.setQueryData(
          queryKeys.notifications.unreadCount,
          context.count,
        );
      if (context?.page)
        queryClient.setQueryData(queryKeys.notifications.list, context.page);
    },
    onSettled: () => invalidateNotifications(queryClient),
  });
}

/** Optimistic: every alert reads as read and the count drops to zero until the server confirms. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiError,
    void,
    { count?: UnreadCount; page?: NotificationPage }
  >({
    mutationFn: () => notificationApi.readAll(),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });
      const count = queryClient.getQueryData<UnreadCount>(
        queryKeys.notifications.unreadCount,
      );
      const page = queryClient.getQueryData<NotificationPage>(
        queryKeys.notifications.list,
      );
      const readAt = new Date().toISOString();
      queryClient.setQueryData<UnreadCount>(
        queryKeys.notifications.unreadCount,
        { count: 0 },
      );
      queryClient.setQueryData<NotificationPage>(
        queryKeys.notifications.list,
        (old) =>
          old && {
            ...old,
            notifications: old.notifications.map((n) =>
              n.readAt ? n : { ...n, readAt },
            ),
          },
      );
      return { count, page };
    },
    onError: (_err, _vars, context) => {
      if (context?.count)
        queryClient.setQueryData(
          queryKeys.notifications.unreadCount,
          context.count,
        );
      if (context?.page)
        queryClient.setQueryData(queryKeys.notifications.list, context.page);
    },
    onSettled: () => invalidateNotifications(queryClient),
  });
}

type TextFields = Pick<
  AppNotification,
  | "kind"
  | "listingKind"
  | "counterpartName"
  | "filePurpose"
  | "blocksVideos"
  | "blocksDocuments"
>;

/** Copy for each alert. Role-aware: the same event reads differently to a student and a tutor, and for packages. */
export function notificationText(n: TextFields): string {
  const name = n.counterpartName;
  const pkg = n.listingKind === "PACKAGE";
  switch (n.kind) {
    case "ID_APPROVED":
      return "Your ID was approved.";
    case "ID_REJECTED":
      return "Your ID was not accepted. Upload a new one.";
    case "VIDEO_APPROVED":
      return "Your video was approved.";
    case "VIDEO_REJECTED":
      return "Your video was not approved.";
    case "STORY_APPROVED":
      return "Your story was approved. We may now show it on our home page.";
    case "STORY_REJECTED":
      return "Your story was not approved.";
    case "FILE_REMOVED":
      switch (n.filePurpose) {
        case "STUDENT_ID":
        case "TUTOR_ID":
          return "An admin removed your ID.";
        case "CREDENTIAL":
          return "An admin removed your certificate.";
        case "TUTOR_VIDEO":
          return "An admin removed your video.";
        case "STORY_IMAGE":
        case "STORY_VIDEO":
          return "An admin removed your story.";
        default:
          return "An admin removed your file.";
      }
    case "UPLOADS_BLOCKED":
      if (n.blocksVideos && n.blocksDocuments)
        return "An admin paused your uploads.";
      if (n.blocksVideos) return "An admin paused your video uploads.";
      if (n.blocksDocuments)
        return "An admin paused your ID and certificate uploads.";
      return "An admin paused your uploads.";
    case "UPLOADS_UNBLOCKED":
      return "You can upload again.";
    case "APPLICATION_RECEIVED":
      return `${name} applied to your tuition.`;
    case "PACKAGE_REQUESTED":
      return `${name} requested your package.`;
    case "APPLICATION_ACCEPTED":
      return pkg
        ? `${name} accepted your request.`
        : `${name} accepted your application.`;
    case "APPLICATION_DECLINED":
      return pkg
        ? `${name} declined your request.`
        : `${name} declined your application.`;
    case "LISTING_FILLED":
      return pkg
        ? "This package was taken by another student."
        : "This tuition hired another tutor.";
    case "APPLICATION_WITHDRAWN":
      return pkg
        ? `${name} withdrew their request.`
        : `${name} withdrew their application.`;
    case "APPLICATION_REOPENED":
      return pkg
        ? `${name} reopened their request.`
        : `${name} reopened their application.`;
    case "APPLICATION_CANCELLED":
      return `${name} cancelled the tuition.`;
    case "APPLICATION_COMPLETED":
      return `${name} marked the tuition as completed.`;
    case "PACKAGE_UPDATED":
      return `${name} updated a package you requested.`;
    case "PACKAGE_CLOSED":
      return `${name} closed a package you requested.`;
    case "REQUIREMENT_INVITED":
      return `${name} invited you to apply to their tuition.`;
  }
}

/**
 * Where an alert leads. Application alerts open the application; ID alerts and
 * removed IDs open the verification card; video, certificate and upload alerts open the dashboard.
 */
export function notificationHref(
  n: Pick<AppNotification, "kind" | "applicationId" | "filePurpose">,
): string {
  switch (n.kind) {
    case "REQUIREMENT_INVITED":
      return "/dashboard/find-tuitions?scope=invited";
    case "ID_APPROVED":
    case "ID_REJECTED":
      return "/dashboard#verification";
    case "FILE_REMOVED":
      if (n.filePurpose === "STUDENT_ID" || n.filePurpose === "TUTOR_ID")
        return "/dashboard#verification";
      return n.filePurpose === "STORY_IMAGE" || n.filePurpose === "STORY_VIDEO"
        ? "/dashboard#stories"
        : "/dashboard";
    case "STORY_APPROVED":
    case "STORY_REJECTED":
      return "/dashboard#stories";
    case "VIDEO_APPROVED":
    case "VIDEO_REJECTED":
    case "UPLOADS_BLOCKED":
    case "UPLOADS_UNBLOCKED":
      return "/dashboard";
    default:
      return n.applicationId
        ? `/dashboard/applications/${n.applicationId}`
        : "/dashboard";
  }
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

/** "Just now", "5m", "3h", "2d", then "12 Nov" from a week on. Future timestamps (clock skew) read as "Just now". */
export function relativeTime(
  date: string | Date,
  now: Date = new Date(),
): string {
  const then = new Date(date);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return DAY_MONTH.format(then);
}
