import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { invalidateFees, queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type TutorFee = Schemas["TutorFee"];
export type TutorFeeDetail = Schemas["TutorFeeDetail"];
export type TutorFeePayment = Schemas["TutorFeePayment"];
export type CheckoutQuote = Schemas["CheckoutQuote"];
export type CheckoutSession = Schemas["CheckoutSession"];
export type PaymentAttemptView = Schemas["PaymentAttemptView"];
export type PaymentAttemptStatus = PaymentAttemptView["status"];
export type FeePromo = Schemas["FeePromo"];
export type TutorRefund = Schemas["TutorRefund"];

export const feeApi = {
  mine: (cursor?: string) =>
    unwrap(client.GET("/api/v1/fees/mine", { params: { query: { cursor } } })),
  get: (id: string) =>
    unwrap(client.GET("/api/v1/fees/{id}", { params: { path: { id } } })),
  checkout: (id: string) =>
    unwrap(
      client.POST("/api/v1/fees/{id}/checkout", { params: { path: { id } } }),
    ),
  applyPromo: (id: string, code: string) =>
    unwrap(
      client.POST("/api/v1/fees/{id}/promo", {
        params: { path: { id } },
        body: { code },
      }),
    ),
  removePromo: (id: string) =>
    unwrap(
      client.DELETE("/api/v1/fees/{id}/promo", { params: { path: { id } } }),
    ),
  requestRefund: (id: string, paymentId: string, reason: string) =>
    unwrap(
      client.POST("/api/v1/fees/{id}/refunds", {
        params: { path: { id } },
        body: { paymentId, reason },
      }),
    ),
  attempt: (id: string, tranId: string) =>
    unwrap(
      client.GET("/api/v1/fees/{id}/attempts/{tranId}", {
        params: { path: { id, tranId } },
      }),
    ),
};

export function useMyFees() {
  return useInfiniteQuery({
    queryKey: queryKeys.fees.mine,
    queryFn: ({ pageParam }) => feeApi.mine(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useMyFee(id: string) {
  return useQuery({
    queryKey: queryKeys.fees.detail(id),
    queryFn: () => feeApi.get(id),
    staleTime: 15_000,
  });
}

/**
 * Starts an SSLCommerz checkout and sends the browser to the gateway page.
 * The fee stays unchanged until the gateway confirms, so nothing is invalidated here.
 */
export function useCheckout(feeId: string) {
  const queryClient = useQueryClient();
  return useMutation<CheckoutSession, ApiError, void>({
    mutationFn: () => feeApi.checkout(feeId),
    onSuccess: (session) => {
      window.location.assign(session.gatewayUrl);
    },
    // A 409 means the fee moved (paid, or a payment in progress): show the fresh state.
    onError: () => invalidateFees(queryClient),
  });
}

/**
 * Promo writes return the fresh fee detail: it goes straight into the cache, then the fee list
 * and applications refresh (a code can change the amount due or waive the fee).
 */
function usePromoWrite<V>(
  feeId: string,
  mutationFn: (variables: V) => Promise<TutorFeeDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation<TutorFeeDetail, ApiError, V>({
    mutationFn,
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.fees.detail(feeId), detail);
    },
    // A 409 (payment started, code used up) means the fee may have moved: show its fresh state.
    onError: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.fees.detail(feeId) }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.fees.mine }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
      ]),
  });
}

export function useApplyPromo(feeId: string) {
  return usePromoWrite<string>(feeId, (code) => feeApi.applyPromo(feeId, code));
}

export function useRemovePromo(feeId: string) {
  return usePromoWrite<void>(feeId, () => feeApi.removePromo(feeId));
}

/** Asks for a refund of one online payment. Same cache handling as the promo writes. */
export function useRequestRefund(feeId: string) {
  return usePromoWrite<{ paymentId: string; reason: string }>(
    feeId,
    ({ paymentId, reason }) => feeApi.requestRefund(feeId, paymentId, reason),
  );
}

/** Attempt states the gateway can still change. Every other state is final for the tutor. */
export function isAttemptSettling(status: PaymentAttemptStatus | undefined) {
  return status === undefined || status === "PENDING";
}

const POLL_FAST_MS = 2_000;
const POLL_SLOW_MS = 10_000;
const FAST_FOR_MS = 60_000;

/**
 * Polls the attempt while the gateway may still confirm it: every 2 s for the first minute,
 * then every 10 s. The server re-checks the gateway on read, so polling is what settles a
 * payment whose redirect was lost.
 */
export function usePaymentAttempt(feeId: string, tranId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.fees.attempt(feeId, tranId ?? ""),
    queryFn: async () => {
      const view = await feeApi.attempt(feeId, tranId ?? "");
      // Not invalidateFees: its ["fees"] prefix covers this query, which would then wait on itself.
      if (!isAttemptSettling(view.status)) {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.fees.mine }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.fees.detail(feeId),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.applications.all,
          }),
        ]);
      }
      return view;
    },
    enabled: Boolean(tranId),
    refetchInterval: (query) => {
      if (!isAttemptSettling(query.state.data?.status)) return false;
      const startedAt = query.state.dataUpdatedAt || Date.now();
      const firstFetch = query.state.dataUpdateCount <= 1;
      return firstFetch || Date.now() - startedAt < FAST_FOR_MS
        ? POLL_FAST_MS
        : POLL_SLOW_MS;
    },
    refetchOnWindowFocus: true,
  });
}

/** Fees the tutor can still pay: DUE or PARTIAL with money left. */
export function isFeeOpen(fee: Pick<TutorFee, "status" | "remaining">) {
  return (
    (fee.status === "DUE" || fee.status === "PARTIAL") &&
    Number(fee.remaining) > 0
  );
}
