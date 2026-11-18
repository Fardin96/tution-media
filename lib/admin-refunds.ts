import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { FeeTone } from "./admin-fees";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminRefund = Schemas["AdminRefund"];
export type AdminRefundDetail = Schemas["AdminRefundDetail"];
export type RefundStatus = AdminRefund["status"];
export type CreateRefundBody = Schemas["CreateRefundInput"];
export type ResolveRefundBody = Schemas["ResolveRefundInput"];

export interface AdminRefundFilters {
  status?: RefundStatus;
  /** true: REQUESTED, PROCESSING or NEEDS_REVIEW. */
  open?: boolean;
  feeId?: string;
}

export const adminRefundsApi = {
  list: (filters: AdminRefundFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/refunds", {
        params: {
          query: {
            status: filters.status,
            open: filters.open ? "true" : undefined,
            feeId: filters.feeId,
            cursor,
          },
        },
      }),
    ),
  get: (id: string) =>
    unwrap(
      client.GET("/api/v1/admin/refunds/{id}", { params: { path: { id } } }),
    ),
  create: (body: CreateRefundBody) =>
    unwrap(client.POST("/api/v1/admin/refunds", { body })),
  approve: (id: string, note?: string) =>
    unwrap(
      client.POST("/api/v1/admin/refunds/{id}/approve", {
        params: { path: { id } },
        body: note ? { note } : {},
      }),
    ),
  reject: (id: string, note: string) =>
    unwrap(
      client.POST("/api/v1/admin/refunds/{id}/reject", {
        params: { path: { id } },
        body: { note },
      }),
    ),
  check: (id: string) =>
    unwrap(
      client.POST("/api/v1/admin/refunds/{id}/check", {
        params: { path: { id } },
      }),
    ),
  resolve: (id: string, body: ResolveRefundBody) =>
    unwrap(
      client.POST("/api/v1/admin/refunds/{id}/resolve", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminRefunds(filters: AdminRefundFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.refunds(filters),
    queryFn: ({ pageParam }) => adminRefundsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminRefund(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.refund(id),
    queryFn: () => adminRefundsApi.get(id),
    staleTime: 15_000,
  });
}

/** A refund can add a ledger row and change what an attempt can still refund: refresh those screens too. */
function invalidateAfterRefundWrite(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.refundsAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.paymentsAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.feesAll }),
    queryClient.invalidateQueries({ queryKey: ["admin", "applications"] }),
  ]);
}

/** Writes the server's refund detail straight into the cache, then refreshes the lists. */
function useRefundWrite<V>(
  mutationFn: (variables: V) => Promise<AdminRefundDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation<AdminRefundDetail, ApiError, V>({
    mutationFn,
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.admin.refund(detail.id), detail);
    },
    onSettled: () => invalidateAfterRefundWrite(queryClient),
  });
}

export function useCreateRefund() {
  return useRefundWrite<CreateRefundBody>(adminRefundsApi.create);
}

export function useApproveRefund(id: string) {
  return useRefundWrite<string | undefined>((note) =>
    adminRefundsApi.approve(id, note),
  );
}

export function useRejectRefund(id: string) {
  return useRefundWrite<string>((note) => adminRefundsApi.reject(id, note));
}

export function useCheckRefund(id: string) {
  return useRefundWrite<void>(() => adminRefundsApi.check(id));
}

export function useResolveRefund(id: string) {
  return useRefundWrite<ResolveRefundBody>((body) =>
    adminRefundsApi.resolve(id, body),
  );
}

export const REFUND_STATUS_META: Record<
  RefundStatus,
  { label: string; tone: FeeTone; hint: string }
> = {
  REQUESTED: {
    label: "Requested",
    tone: "warning",
    hint: "The tutor asked for this refund. A super admin approves or declines it.",
  },
  REJECTED: {
    label: "Declined",
    tone: "neutral",
    hint: "Declined. Nothing was sent to the gateway.",
  },
  PROCESSING: {
    label: "Processing",
    tone: "info",
    hint: "The gateway accepted the refund and is sending the money back.",
  },
  SUCCEEDED: {
    label: "Refunded",
    tone: "success",
    hint: "The gateway returned the money.",
  },
  FAILED: {
    label: "Failed",
    tone: "neutral",
    hint: "The gateway refused or cancelled the refund. No money moved.",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    tone: "error",
    hint: "The gateway didn't answer clearly. Check the merchant panel, then resolve it here.",
  },
};

/** What a tutor sees for each refund status. */
export const TUTOR_REFUND_STATUS: Record<
  RefundStatus,
  { label: string; tone: FeeTone }
> = {
  REQUESTED: { label: "Requested", tone: "warning" },
  REJECTED: { label: "Declined", tone: "neutral" },
  PROCESSING: { label: "In progress", tone: "info" },
  NEEDS_REVIEW: { label: "In progress", tone: "info" },
  SUCCEEDED: { label: "Refunded", tone: "success" },
  FAILED: { label: "Didn't go through", tone: "neutral" },
};

export const REFUND_NOTE_MIN = 3;
export const REFUND_NOTE_MAX = 500;

/** Inline message for a refund reason or note (3 to 500 characters after trimming), or undefined. */
export function validateRefundText(text: string): string | undefined {
  const length = text.trim().length;
  if (length < REFUND_NOTE_MIN) return "Write at least 3 characters.";
  if (length > REFUND_NOTE_MAX) {
    return `Keep it to ${REFUND_NOTE_MAX} characters or fewer.`;
  }
  return undefined;
}
