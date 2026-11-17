import { useInfiniteQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminApplication = Schemas["AdminApplication"];
export type AdminApplicationStatus = AdminApplication["status"];
export type AdminApplicationKind = AdminApplication["kind"];

export interface AdminApplicationFilters {
  status?: AdminApplicationStatus;
  kind?: AdminApplicationKind;
}

export const adminApplicationApi = {
  list: (filters: AdminApplicationFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/applications", {
        params: {
          query: { status: filters.status, kind: filters.kind, cursor },
        },
      }),
    ),
};

export function useAdminApplications(filters: AdminApplicationFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.applications(filters),
    queryFn: ({ pageParam }) => adminApplicationApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}
