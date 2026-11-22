import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { getStoredTokens } from "./api";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { refreshSiteContent } from "./site-content.actions";
import { refreshTutorProfilesAsAdmin } from "./tutor-profile.actions";

export type AdminAccountSummary = Schemas["AdminAccountSummary"];
export type AdminAccountDetail = Schemas["AdminAccountDetail"];
export type AccountRole = AdminAccountSummary["role"];
export type AccountStatus = AdminAccountSummary["status"];

export type AccountFilters = {
  q?: string;
  role?: AccountRole;
  status?: AccountStatus;
};

export const BLOCK_REASON_MIN = 3;
export const BLOCK_REASON_MAX = 500;

export const adminAccountApi = {
  list: (filters: AccountFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/accounts", {
        params: {
          query: {
            q: filters.q || undefined,
            role: filters.role,
            status: filters.status,
            cursor,
          },
        },
      }),
    ),
  get: (id: string) =>
    unwrap(
      client.GET("/api/v1/admin/accounts/{id}", {
        params: { path: { id } },
      }),
    ),
  block: (id: string, reason: string) =>
    unwrap(
      client.POST("/api/v1/admin/accounts/{id}/block", {
        params: { path: { id } },
        body: { reason },
      }),
    ),
  unblock: (id: string) =>
    unwrap(
      client.POST("/api/v1/admin/accounts/{id}/unblock", {
        params: { path: { id } },
      }),
    ),
  /** The soft delete; the admin panel calls it "Deactivate". */
  deactivate: (id: string, reason: string) =>
    unwrap(
      client.POST("/api/v1/admin/accounts/{id}/deactivate", {
        params: { path: { id } },
        body: { reason },
      }),
    ),
  hardDelete: (id: string, reason: string) =>
    unwrap(
      client.POST("/api/v1/admin/accounts/{id}/hard-delete", {
        params: { path: { id } },
        body: { reason },
      }),
    ),
};

/** Length is counted after trimming, so the same text is sent that was checked. */
export function validateBlockReason(text: string): string | undefined {
  const length = text.trim().length;
  if (length < BLOCK_REASON_MIN)
    return `Write at least ${BLOCK_REASON_MIN} characters.`;
  if (length > BLOCK_REASON_MAX)
    return `Keep it under ${BLOCK_REASON_MAX} characters.`;
  return undefined;
}

export function useAdminAccounts(filters: AccountFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.accounts(filters),
    queryFn: ({ pageParam }) => adminAccountApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminAccount(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.account(id),
    queryFn: () => adminAccountApi.get(id),
    staleTime: 15_000,
  });
}

/**
 * Expires the cached public tutor pages after a moderation that changes them. Fire-and-forget:
 * the admin's change has already succeeded, so a failed refresh is dropped.
 */
async function refreshPublicTutors(): Promise<void> {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await refreshTutorProfilesAsAdmin(tokens.accessToken);
  } catch {
    // The public profile catches up within 60 seconds anyway.
  }
}

/** Deactivate and delete take the account's stories and videos off the landing page. */
async function refreshLanding(): Promise<void> {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await refreshSiteContent(tokens.accessToken);
  } catch {
    // The landing refreshes within 30 minutes anyway.
  }
}

/** Block, unblock and deactivate move the account lists, its detail and the admin roster. */
function applyAccountDetail(
  queryClient: QueryClient,
  id: string,
  detail: AdminAccountDetail,
) {
  queryClient.setQueryData(queryKeys.admin.account(id), detail);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.accountsAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.team }),
  ]);
}

export function useBlockAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => adminAccountApi.block(id, reason),
    onSuccess: (detail) => {
      void refreshPublicTutors();
      return applyAccountDetail(queryClient, id, detail);
    },
  });
}

export function useUnblockAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminAccountApi.unblock(id),
    onSuccess: (detail) => {
      void refreshPublicTutors();
      return applyAccountDetail(queryClient, id, detail);
    },
  });
}

export function useDeactivateAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => adminAccountApi.deactivate(id, reason),
    onSuccess: (detail) => {
      void refreshPublicTutors();
      void refreshLanding();
      return applyAccountDetail(queryClient, id, detail);
    },
  });
}

/** The account is gone afterwards: its detail leaves the cache instead of refetching into a 404. */
export function useHardDeleteAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => adminAccountApi.hardDelete(id, reason),
    onSuccess: () => {
      void refreshPublicTutors();
      void refreshLanding();
      queryClient.removeQueries({ queryKey: queryKeys.admin.account(id) });
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.accountsAll,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.team }),
      ]);
    },
  });
}
