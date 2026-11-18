import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminVideo = Schemas["AdminVideo"];
export type AdminVideoPage = Schemas["AdminVideoPage"];
export type VideoStatus = AdminVideo["status"];
export type ModerateVideoInput = Schemas["ModerateVideoInput"];
export type UpdateVideoInput = Schemas["UpdateVideoInput"];

export const adminVideoApi = {
  list: (status: VideoStatus, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/videos", {
        params: { query: { status, cursor } },
      }),
    ),
  moderate: (id: string, body: ModerateVideoInput) =>
    unwrap(
      client.POST("/api/v1/admin/videos/{id}/moderate", {
        params: { path: { id } },
        body,
      }),
    ),
  update: (id: string, body: UpdateVideoInput) =>
    unwrap(
      client.PATCH("/api/v1/admin/videos/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminVideos(status: VideoStatus) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.videos({ status }),
    queryFn: ({ pageParam }) => adminVideoApi.list(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/** An approve, reject or take-down. The public tutor pages and every video queue can change. */
export function useModerateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ModerateVideoInput }) =>
      adminVideoApi.moderate(id, body),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.videosAll }),
  });
}

/** Saves a video's display order. */
export function useUpdateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateVideoInput }) =>
      adminVideoApi.update(id, body),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.videosAll }),
  });
}

type Tone = "neutral" | "warning" | "success" | "error";

export const VIDEO_STATUS_META: Record<
  VideoStatus,
  { label: string; tone: Tone }
> = {
  PENDING: { label: "Waiting for review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "error" },
};

const SORT_ORDER_MAX = 10000;

/** Display order: a whole number from 0 to 10000. Lower shows first. */
export function validateSortOrder(text: string): string | undefined {
  const value = text.trim();
  if (!/^\d+$/.test(value) || Number(value) > SORT_ORDER_MAX) {
    return "Enter a whole number from 0 to 10000.";
  }
  return undefined;
}
