import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { formatAmount } from "./admin";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminFee = Schemas["AdminFee"];
export type AdminFeeDetail = Schemas["AdminFeeDetail"];
export type AdminFeePayment = Schemas["AdminFeePayment"];
export type AdminFeePage = Schemas["AdminFeePage"];
export type FeeStatus = AdminFee["status"];
export type UpdateFeeBody = Schemas["UpdateFeeInput"];
export type RecordPaymentBody = Schemas["RecordPaymentInput"];
export type ReversePaymentBody = Schemas["ReversePaymentInput"];

export interface AdminFeeFilters {
  status?: FeeStatus;
  overdue?: boolean;
}

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export const adminFeeApi = {
  list: (filters: AdminFeeFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/fees", {
        params: {
          query: {
            status: filters.status,
            overdue:
              filters.overdue === undefined
                ? undefined
                : filters.overdue
                  ? "true"
                  : "false",
            cursor,
          },
        },
      }),
    ),
  get: (id: string) =>
    unwrap(client.GET("/api/v1/admin/fees/{id}", { params: { path: { id } } })),
  update: (id: string, body: UpdateFeeBody) =>
    unwrap(
      client.PATCH("/api/v1/admin/fees/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
  recordPayment: (id: string, body: RecordPaymentBody) =>
    unwrap(
      client.POST("/api/v1/admin/fees/{id}/payments", {
        params: { path: { id } },
        body,
      }),
    ),
  reversePayment: (paymentId: string, body: ReversePaymentBody) =>
    unwrap(
      client.POST("/api/v1/admin/payments/{id}/reverse", {
        params: { path: { id: paymentId } },
        body,
      }),
    ),
};

/**
 * Every fee write changes the fee lists, the fee detail and the applications' fee summaries, and
 * the fee state shown on payment attempts and refunds (a waive or cash payment decides what a
 * pending online payment or refund can still do).
 */
function invalidateAdminFees(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.feesAll }),
    queryClient.invalidateQueries({ queryKey: ["admin", "applications"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.paymentsAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.refundsAll }),
  ]);
}

export function useAdminFees(filters: AdminFeeFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.fees(filters),
    queryFn: ({ pageParam }) => adminFeeApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminFee(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.fee(id),
    queryFn: () => adminFeeApi.get(id),
    staleTime: 15_000,
  });
}

/** Writes the server's fee detail straight into the cache, then refreshes every fee list. */
function useFeeWrite<V>(
  feeId: string,
  mutationFn: (variables: V) => Promise<AdminFeeDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation<AdminFeeDetail, ApiError, V>({
    mutationFn,
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.admin.fee(feeId), detail);
    },
    onSettled: () => invalidateAdminFees(queryClient),
  });
}

export function useUpdateFee(id: string) {
  return useFeeWrite<UpdateFeeBody>(id, (body) => adminFeeApi.update(id, body));
}

export function useRecordPayment(id: string) {
  return useFeeWrite<RecordPaymentBody>(id, (body) =>
    adminFeeApi.recordPayment(id, body),
  );
}

export function useReversePayment(feeId: string) {
  return useFeeWrite<{ paymentId: string; body: ReversePaymentBody }>(
    feeId,
    ({ paymentId, body }) => adminFeeApi.reversePayment(paymentId, body),
  );
}

export type FeeTone = "neutral" | "info" | "success" | "warning" | "error";

export const FEE_STATUS_META: Record<
  FeeStatus,
  { label: string; tone: FeeTone }
> = {
  DUE: { label: "Due", tone: "warning" },
  PARTIAL: { label: "Partly paid", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  WAIVED: { label: "Waived", tone: "neutral" },
  VOID: { label: "Void", tone: "neutral" },
};

export const FEE_TYPE_LABEL: Record<AdminFee["feeType"], string> = {
  PLACEMENT: "Placement",
  RECURRING: "Recurring",
  OTHER: "Other",
};

export const PAYMENT_METHOD_LABEL: Record<AdminFeePayment["method"], string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  BANK: "Bank",
  CASH: "Cash",
  SSLCOMMERZ: "SSLCommerz",
  OTHER: "Other",
};

/** Strips thousands separators so "1,500" reads as 1500. */
export function parseAmount(text: string): number {
  return Number(text.trim().replace(/,/g, ""));
}

const AMOUNT_FORMAT = /^\d+(\.\d+)?$/;

/** Inline message for an amount in taka, or undefined when it is valid. `max` is the most that may be entered. */
export function validateAmount(
  text: string,
  max?: string | number,
): string | undefined {
  const cleaned = text.trim().replace(/,/g, "");
  if (!AMOUNT_FORMAT.test(cleaned) || Number(cleaned) <= 0) {
    return "Enter an amount in taka.";
  }
  const decimals = cleaned.split(".")[1] ?? "";
  if (decimals.length > 2) return "Use at most 2 decimal places.";
  if (max !== undefined && Number(cleaned) > Number(max)) {
    return `More than the ${formatAmount(max)} still due.`;
  }
  return undefined;
}

/** Inline message for a reversal reason (3 to 500 characters after trimming), or undefined. */
export function validateReason(text: string): string | undefined {
  const length = text.trim().length;
  if (length < REASON_MIN) return "Give a reason with at least 3 characters.";
  if (length > REASON_MAX) {
    return `Keep the reason to ${REASON_MAX} characters or fewer.`;
  }
  return undefined;
}

const DUE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "17 Nov 2026" from a YYYY-MM-DD due date. Built in UTC so no timezone shifts the day. */
export function formatDueDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return DUE_DATE_FORMAT.format(date);
}

/** Value for a datetime-local input, in the browser's local time. */
export function localDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
}

/** ISO string for a datetime-local value, or undefined when it does not parse. */
export function localDateTimeToIso(value: string): string | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
