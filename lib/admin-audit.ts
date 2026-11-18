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
