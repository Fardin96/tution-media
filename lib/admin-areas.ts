import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { paths } from "./api-types";
import { clearAreaCache } from "./areas";
import { queryKeys } from "./query-keys";

export type AdminArea = Schemas["AdminArea"];
export type AdminAreaDistrict = Schemas["AdminAreaDistrict"];

/** The list filters. Empty district or search means no filter. */
export type AreaFilters = {
  districtCode?: string;
  q?: string;
  status: "active" | "inactive" | "all";
};

/** The fields the create form sends. */
export type AreaFields = { districtCode: string; name: string };

type DistrictCode = NonNullable<
  NonNullable<
    paths["/api/v1/admin/areas"]["get"]["parameters"]["query"]
  >["districtCode"]
>;

export const AREA_NAME_MIN = 2;
export const AREA_NAME_MAX = 60;

export const adminAreaApi = {
  list: (filters: AreaFilters) =>
    unwrap(
      client.GET("/api/v1/admin/areas", {
        params: {
          query: {
            districtCode: (filters.districtCode || undefined) as
              DistrictCode | undefined,
            q: filters.q || undefined,
            isActive:
              filters.status === "all"
                ? undefined
                : filters.status === "active"
                  ? "true"
                  : "false",
          },
        },
      }),
    ),
  create: (body: AreaFields) =>
    unwrap(
      client.POST("/api/v1/admin/areas", {
        body: { ...body, districtCode: body.districtCode as DistrictCode },
      }),
    ),
  update: (id: number, body: { name?: string; isActive?: boolean }) =>
    unwrap(
      client.PATCH("/api/v1/admin/areas/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminAreas(filters: AreaFilters) {
  return useQuery({
    queryKey: queryKeys.admin.areas(filters),
    queryFn: () => adminAreaApi.list(filters),
    staleTime: 15_000,
    // Keeps the last list on screen while a new search loads, so typing doesn't flash the skeleton.
    placeholderData: keepPreviousData,
  });
}

/** Area writes change the admin list and the public list that every picker reads. */
function invalidateAreas(queryClient: QueryClient) {
  clearAreaCache();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.areasAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.areas }),
  ]);
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AreaFields) => adminAreaApi.create(body),
    onSuccess: () => invalidateAreas(queryClient),
  });
}

export function useUpdateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { name?: string; isActive?: boolean };
    }) => adminAreaApi.update(id, body),
    onSuccess: () => invalidateAreas(queryClient),
  });
}

/** Required, 2 to 60 characters once trimmed. */
export function validateAreaName(text: string): string | undefined {
  const name = text.trim();
  if (name === "") return "Enter an area name.";
  if (name.length < AREA_NAME_MIN)
    return `Use at least ${AREA_NAME_MIN} characters.`;
  if (name.length > AREA_NAME_MAX)
    return `Use ${AREA_NAME_MAX} characters or fewer.`;
  return undefined;
}
