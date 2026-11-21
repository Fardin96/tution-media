import { useInfiniteQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

export type AuditEntry = Schemas["AuditLogEntry"];

/** URL-driven filters. Only the entity type is exposed in the UI. */
export type AuditFilters = { entityType?: string };

export const auditLogApi = {
  list: (filters: AuditFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/audit-logs", {
        params: {
          query: {
            ...(filters.entityType ? { entityType: filters.entityType } : {}),
            cursor,
          },
        },
      }),
    ),
};

export function useAuditLog(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.auditLogs(filters),
    queryFn: ({ pageParam }) => auditLogApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/** Plain-language labels for the actions the admin tools write. Unknown actions show their raw name. */
const ACTION_LABELS: Record<string, string> = {
  "fee.create": "Created a fee",
  "fee.update": "Changed a fee",
  "fee.payment": "Recorded a payment",
  "payment.reverse": "Reversed a payment",
  "account.block": "Blocked an account",
  "account.unblock": "Unblocked an account",
  "admin.approve": "Approved an admin",
  "admin.remove": "Removed an admin",
  "package.moderate": "Reviewed a package",
  "subject.create": "Added a subject",
  "subject.update": "Changed a subject",
  "setting.update": "Changed a setting",
  "zone_limit_request.decide": "Decided a zone request",
  "payment.check": "Checked a payment with the gateway",
  "payment.review": "Decided a flagged payment",
  "promo.create": "Created a promo code",
  "promo.update": "Changed a promo code",
  "refund.create": "Started a refund",
  "refund.approve": "Approved a refund",
  "refund.reject": "Declined a refund",
  "refund.check": "Checked a refund with the gateway",
  "refund.resolve": "Resolved a refund by hand",
  "verification.decide": "Decided an ID verification",
  "video.moderate": "Decided a tutor video",
  "video.update": "Changed a video's order",
  "story.moderate": "Reviewed a story",
  "file.view": "Opened a private file",
  "file.delete": "Deleted a file",
  "file.remove": "Removed a user's file",
  "uploads.block": "Paused a user's uploads",
  "uploads.unblock": "Resumed a user's uploads",
  "blog.create": "Created a blog post",
  "blog.update": "Changed a blog post",
  "blog.delete": "Deleted a blog post",
  "review.moderate": "Hid or restored a review",
  "report.assign": "Took a report",
  "report.resolve": "Resolved a report",
  "report.dismiss": "Dismissed a report",
  "dispute.assign": "Took a dispute",
  "dispute.resolve": "Resolved a dispute",
  "dispute.dismiss": "Dismissed a dispute",
  "matching.update": "Matching rules updated",
  "city.upsert": "City boundary saved",
  "city.update": "City updated",
  "site_content.update": "Changed site content",
  "site_content.reset": "Reset site content to the default",
  "site_content.source_removed": "Took a submission off the home page",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Name for the actor, or "System" when the change had no signed-in admin. */
export function actorName(actor: AuditEntry["actor"]): string {
  if (!actor) return "System";
  return actor.name || actor.email;
}

/** Pretty JSON for a before or after snapshot. Missing values show as null. */
export function formatSnapshot(value: unknown): string {
  if (value === undefined) return "null";
  return JSON.stringify(value, null, 2) ?? "null";
}
