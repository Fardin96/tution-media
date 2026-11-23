import { useQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

// Shape comes from tuition-api's OpenAPI document (lib/api-types.ts).
export type UploadStatus = Schemas["UploadStatus"];
export type UploadCategory = "videos" | "documents";

const STALE_MS = 60_000;

export const uploadStatusApi = {
  get: () => unwrap(client.GET("/api/v1/files/upload-status")),
};

/** Whether an admin has paused this user's uploads. Refetches on window focus (default) and after a minute. */
export function useUploadStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.uploadStatus,
    queryFn: () => uploadStatusApi.get(),
    enabled,
    staleTime: STALE_MS,
  });
}

/**
 * The static line for a paused category, or null when that category is open.
 * Videos: "An admin paused your video uploads." Documents: IDs, certificates and photos.
 */
export function pausedText(
  status: UploadStatus | null | undefined,
  category: UploadCategory,
): string | null {
  if (!status) return null;
  if (category === "videos") {
    return status.blocksVideos ? "An admin paused your video uploads." : null;
  }
  return status.blocksDocuments
    ? "An admin paused your ID, certificate and photo uploads."
    : null;
}
