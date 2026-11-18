import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminPromoCode = Schemas["AdminPromoCode"];
export type AdminPromoCodeDetail = Schemas["AdminPromoCodeDetail"];
export type AdminPromoRedemption = Schemas["AdminPromoRedemption"];
export type CreatePromoCodeBody = Schemas["CreatePromoCodeInput"];
export type UpdatePromoCodeBody = Schemas["UpdatePromoCodeInput"];
export type PromoDiscountType = AdminPromoCode["discountType"];

export interface AdminPromoFilters {
  active?: boolean;
}

export const promoCodeApi = {
  list: (filters: AdminPromoFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/promo-codes", {
        params: {
          query: {
            active:
              filters.active === undefined
                ? undefined
                : filters.active
                  ? "true"
                  : "false",
            cursor,
          },
        },
      }),
    ),
  get: (id: string) =>
    unwrap(
      client.GET("/api/v1/admin/promo-codes/{id}", {
        params: { path: { id } },
      }),
    ),
  create: (body: CreatePromoCodeBody) =>
    unwrap(client.POST("/api/v1/admin/promo-codes", { body })),
  update: (id: string, body: UpdatePromoCodeBody) =>
    unwrap(
      client.PATCH("/api/v1/admin/promo-codes/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminPromoCodes(filters: AdminPromoFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.promoCodes(filters),
    queryFn: ({ pageParam }) => promoCodeApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminPromoCode(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.promoCode(id),
    queryFn: () => promoCodeApi.get(id),
    staleTime: 15_000,
  });
}

export function useCreatePromoCode() {
  const queryClient = useQueryClient();
  return useMutation<AdminPromoCodeDetail, ApiError, CreatePromoCodeBody>({
    mutationFn: promoCodeApi.create,
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.admin.promoCode(detail.id), detail);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.promoCodesAll,
      }),
  });
}

export function useUpdatePromoCode(id: string) {
  const queryClient = useQueryClient();
  return useMutation<AdminPromoCodeDetail, ApiError, UpdatePromoCodeBody>({
    mutationFn: (body) => promoCodeApi.update(id, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.admin.promoCode(id), detail);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.promoCodesAll,
      }),
  });
}

export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;

/** Inline message for a code name, or undefined. Codes are stored uppercase. */
export function validateCode(text: string): string | undefined {
  const value = text.trim();
  if (!value) return "Enter a code.";
  if (!CODE_PATTERN.test(value)) {
    return "Use 3 to 32 letters, digits, - or _, starting with a letter or digit.";
  }
  return undefined;
}

/** "20% off (up to ৳500)" or "৳300 off". `formatAmount` comes from the caller to keep one money format per page. */
export function discountText(
  promo: Pick<AdminPromoCode, "discountType" | "discountValue" | "maxDiscount">,
  formatAmount: (value: string) => string,
): string {
  if (promo.discountType === "FLAT") {
    return `${formatAmount(promo.discountValue)} off`;
  }
  const percent = `${Number(promo.discountValue)}% off`;
  return promo.maxDiscount
    ? `${percent} (up to ${formatAmount(promo.maxDiscount)})`
    : percent;
}

export type PromoState = "active" | "scheduled" | "ended" | "used-up" | "off";

/** Where a code stands right now, for the status pill. */
export function promoState(
  promo: AdminPromoCode,
  now = new Date(),
): PromoState {
  if (!promo.isActive) return "off";
  if (promo.endsAt && new Date(promo.endsAt) <= now) return "ended";
  if (promo.startsAt && new Date(promo.startsAt) > now) return "scheduled";
  if (
    promo.maxRedemptions !== null &&
    promo.redemptionCount >= promo.maxRedemptions
  ) {
    return "used-up";
  }
  return "active";
}

export const PROMO_STATE_META: Record<
  PromoState,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" }
> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  ended: { label: "Ended", tone: "neutral" },
  "used-up": { label: "Used up", tone: "warning" },
  off: { label: "Turned off", tone: "neutral" },
};
