import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminPackage = Schemas["AdminPackage"];
export type AdminPackagePage = Schemas["AdminPackagePage"];
export type ModeratePackageInput = Schemas["ModeratePackageInput"];
export type PackageModerationStatus = AdminPackage["moderationStatus"];

export const adminPackageApi = {
  list: (moderationStatus: PackageModerationStatus, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/packages", {
        params: { query: { moderationStatus, cursor } },
      }),
    ),
  get: (id: string) =>
    unwrap(
      client.GET("/api/v1/admin/packages/{id}", {
        params: { path: { id } },
      }),
    ),
  moderate: (id: string, body: ModeratePackageInput) =>
    unwrap(
      client.POST("/api/v1/admin/packages/{id}/moderate", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminPackages(moderationStatus: PackageModerationStatus) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.packages({ moderationStatus }),
    queryFn: ({ pageParam }) =>
      adminPackageApi.list(moderationStatus, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminPackage(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.package(id),
    queryFn: () => adminPackageApi.get(id),
    staleTime: 15_000,
  });
}

/** An approve or reject. Students' browse lists, the tutor's own list and every admin queue can change. */
export function useModeratePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ModeratePackageInput }) =>
      adminPackageApi.moderate(id, body),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.packagesAll,
        }),
        queryClient.invalidateQueries({ queryKey: ["browse"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.packages.mine }),
      ]),
  });
}

const REJECT_NOTE_MAX = 500;

/** The note a tutor reads when a package is rejected. Required, at most 500 characters. */
export function validateRejectNote(text: string): string | undefined {
  const note = text.trim();
  if (note === "") return "Tell the tutor what to change.";
  if (note.length > REJECT_NOTE_MAX) return "Keep it under 500 characters.";
  return undefined;
}
