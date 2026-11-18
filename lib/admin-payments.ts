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
export type AdminPaymentAttempt = Schemas["AdminPaymentAttempt"];
export type AdminPaymentAttemptDetail = Schemas["AdminPaymentAttemptDetail"];
export type AdminPaymentSummary = Schemas["AdminPaymentSummary"];
export type AdminFeeAttempt = Schemas["AdminFeeAttempt"];
export type AttemptStatus = AdminPaymentAttempt["status"];
export type ReviewPaymentBody = Schemas["ReviewPaymentInput"];
export type ReviewDecision = ReviewPaymentBody["decision"];

export interface AdminPaymentFilters {
  status?: AttemptStatus;
  /** true: REVIEW or UNAPPLIED, the attempts where money arrived but no ledger row was written. */
  attention?: boolean;
  feeId?: string;
}

export const NOTE_MIN = 3;
export const NOTE_MAX = 500;

export const adminPaymentsApi = {
  list: (filters: AdminPaymentFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/payment-attempts", {
        params: {
          query: {
            status: filters.status,
            attention: filters.attention ? "true" : undefined,
            feeId: filters.feeId,
            cursor,
          },
        },
      }),
    ),
  summary: () => unwrap(client.GET("/api/v1/admin/payment-attempts/summary")),
  get: (tranId: string) =>
    unwrap(
      client.GET("/api/v1/admin/payment-attempts/{tranId}", {
        params: { path: { tranId } },
      }),
    ),
  check: (tranId: string) =>
    unwrap(
      client.POST("/api/v1/admin/payment-attempts/{tranId}/check", {
        params: { path: { tranId } },
      }),
    ),
  review: (tranId: string, body: ReviewPaymentBody) =>
    unwrap(
      client.POST("/api/v1/admin/payment-attempts/{tranId}/review", {
        params: { path: { tranId } },
        body,
      }),
    ),
};

export function useAdminPaymentAttempts(filters: AdminPaymentFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.paymentAttempts(filters),
    queryFn: ({ pageParam }) => adminPaymentsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminPaymentSummary() {
  return useQuery({
    queryKey: queryKeys.admin.paymentSummary,
    queryFn: adminPaymentsApi.summary,
    staleTime: 15_000,
  });
}

export function useAdminPaymentAttempt(tranId: string) {
  return useQuery({
    queryKey: queryKeys.admin.paymentAttempt(tranId),
    queryFn: () => adminPaymentsApi.get(tranId),
    staleTime: 15_000,
  });
}

/** A check or a review can post a ledger row, so the fee screens refresh too. */
function invalidateAfterPaymentWrite(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.paymentsAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.feesAll }),
    queryClient.invalidateQueries({ queryKey: ["admin", "applications"] }),
  ]);
}

/** Writes the server's attempt detail straight into the cache, then refreshes the lists. */
function useAttemptWrite<V>(
  tranId: string,
  mutationFn: (variables: V) => Promise<AdminPaymentAttemptDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation<AdminPaymentAttemptDetail, ApiError, V>({
    mutationFn,
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.admin.paymentAttempt(tranId), detail);
    },
    onSettled: () => invalidateAfterPaymentWrite(queryClient),
  });
}

export function useCheckPaymentAttempt(tranId: string) {
  return useAttemptWrite<void>(tranId, () => adminPaymentsApi.check(tranId));
}

export function useReviewPaymentAttempt(tranId: string) {
  return useAttemptWrite<ReviewPaymentBody>(tranId, (body) =>
    adminPaymentsApi.review(tranId, body),
  );
}

export const ATTEMPT_STATUS_META: Record<
  AttemptStatus,
  { label: string; tone: FeeTone; hint: string }
> = {
  PENDING: {
    label: "In progress",
    tone: "info",
    hint: "Waiting for the gateway to confirm.",
  },
  SUCCEEDED: {
    label: "Paid",
    tone: "success",
    hint: "Confirmed by the gateway and added to the fee.",
  },
  FAILED: {
    label: "Failed",
    tone: "neutral",
    hint: "The gateway didn't take the money.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "neutral",
    hint: "The tutor left the gateway page.",
  },
  EXPIRED: {
    label: "Expired",
    tone: "neutral",
    hint: "Never completed, or replaced by a newer checkout.",
  },
  REVIEW: {
    label: "Needs review",
    tone: "warning",
    hint: "The gateway says paid, but something doesn't match. Decide it.",
  },
  UNAPPLIED: {
    label: "Not applied",
    tone: "error",
    hint: "The gateway took the money but it isn't on the fee. Needs a refund.",
  },
};

/** Inline message for a review note (3 to 500 characters after trimming), or undefined. */
export function validateNote(text: string): string | undefined {
  const length = text.trim().length;
  if (length < NOTE_MIN) return "Write a note with at least 3 characters.";
  if (length > NOTE_MAX) {
    return `Keep the note to ${NOTE_MAX} characters or fewer.`;
  }
  return undefined;
}
