import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

export type AdminTeamMember = Schemas["AdminTeamMember"];

export const adminTeamApi = {
  list: async (): Promise<AdminTeamMember[]> =>
    (await unwrap(client.GET("/api/v1/admin/admins"))).admins,
  approve: (accountId: string) =>
    unwrap(
      client.POST("/api/v1/admin/admins/{accountId}/approve", {
        params: { path: { accountId } },
      }),
    ),
  remove: (accountId: string) =>
    unwrap(
      client.POST("/api/v1/admin/admins/{accountId}/remove", {
        params: { path: { accountId } },
      }),
    ),
};

/** Team changes move the roster and the accounts list, which shows admin roles. */
function invalidateTeam(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.team }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.accountsAll }),
  ]);
}

export function useAdminTeam() {
  return useQuery({
    queryKey: queryKeys.admin.team,
    queryFn: adminTeamApi.list,
    staleTime: 15_000,
  });
}

export function useApproveAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => adminTeamApi.approve(accountId),
    onSuccess: () => invalidateTeam(queryClient),
  });
}

export function useRemoveAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => adminTeamApi.remove(accountId),
    onSuccess: () => invalidateTeam(queryClient),
  });
}
