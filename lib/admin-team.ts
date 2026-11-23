import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

export type AdminTeamMember = Schemas["AdminTeamMember"];
export type AdminInvite = Schemas["AdminInvite"];

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
  invites: async (): Promise<AdminInvite[]> =>
    (await unwrap(client.GET("/api/v1/admin/admins/invites"))).invites,
  invite: (email: string) =>
    unwrap(client.POST("/api/v1/admin/admins/invites", { body: { email } })),
  revokeInvite: (id: string) =>
    unwrap(
      client.DELETE("/api/v1/admin/admins/invites/{id}", {
        params: { path: { id } },
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

/** Super admins only; the route answers 403 to anyone else. The section mounts only for them. */
export function useAdminInvites() {
  return useQuery({
    queryKey: queryKeys.admin.adminInvites,
    queryFn: adminTeamApi.invites,
    staleTime: 15_000,
  });
}

export function useInviteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => adminTeamApi.invite(email),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.adminInvites }),
  });
}

export function useRevokeAdminInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminTeamApi.revokeInvite(id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.adminInvites }),
  });
}
