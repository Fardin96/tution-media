import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

// One account's upload history and pause (block) on the admin account page.

export type UploadHistory = Schemas["UploadHistory"];
export type UploadReviewEvent = Schemas["UploadReviewEvent"];
export type UploadBlockView = Schemas["UploadBlockView"];
export type UploadPurpose = NonNullable<UploadReviewEvent["purpose"]>;
export type UploadEventAction = UploadReviewEvent["action"];

export type UploadBlockInput = {
  blocksVideos: boolean;
  blocksDocuments: boolean;
  note: string;
  noteVisible: boolean;
};

export type UploadLiftInput = { note?: string; noteVisible?: boolean };

export const adminUploadsApi = {
  history: (accountId: string, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/accounts/{accountId}/uploads", {
        params: { path: { accountId }, query: { cursor } },
      }),
    ),
  setBlock: (accountId: string, body: UploadBlockInput) =>
    unwrap(
      client.PUT("/api/v1/admin/accounts/{accountId}/upload-block", {
        params: { path: { accountId } },
        body,
      }),
    ),
  liftBlock: (accountId: string, body?: UploadLiftInput) =>
    unwrap(
      client.POST("/api/v1/admin/accounts/{accountId}/upload-block/lift", {
        params: { path: { accountId } },
        body: body ?? null,
      }),
    ),
};

export function useUploadHistory(accountId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.uploadHistory(accountId),
    queryFn: ({ pageParam }) => adminUploadsApi.history(accountId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/** A pause or a lift changes the history here and the upload flags on the queues. */
function invalidateUploads(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.uploadsAll }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.admin.verificationsAll,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.videosAll }),
  ]);
}

export function useSetUploadBlock(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UploadBlockInput) =>
      adminUploadsApi.setBlock(accountId, body),
    onSuccess: () => invalidateUploads(queryClient),
  });
}

export function useLiftUploadBlock(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: UploadLiftInput) =>
      adminUploadsApi.liftBlock(accountId, body),
    onSuccess: () => invalidateUploads(queryClient),
  });
}

/** "Videos", "IDs, certificates and photos", or both; null when nothing is paused. */
export function blockScopeText(block: {
  blocksVideos: boolean;
  blocksDocuments: boolean;
}): string | null {
  if (block.blocksVideos && block.blocksDocuments)
    return "Videos, IDs, certificates and photos";
  if (block.blocksVideos) return "Videos";
  if (block.blocksDocuments) return "IDs, certificates and photos";
  return null;
}

export function validateBlockScope(
  videos: boolean,
  documents: boolean,
): string | undefined {
  return videos || documents ? undefined : "Pick videos, documents or both.";
}

const EVENT_TITLE: Record<UploadEventAction, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVOKED: "Approval revoked",
  REMOVED: "File removed",
  BLOCKED: "Uploads paused",
  UNBLOCKED: "Uploads resumed",
};

export function eventTitle(event: { action: UploadEventAction }): string {
  return EVENT_TITLE[event.action];
}

const PURPOSE_TEXT: Record<UploadPurpose, string> = {
  STUDENT_ID: "Student ID",
  TUTOR_ID: "Tutor ID",
  CREDENTIAL: "Certificate",
  TUTOR_VIDEO: "Video",
  BLOG_COVER: "Blog cover",
  SITE_IMAGE: "Site image",
  SITE_VIDEO: "Site video",
  STORY_IMAGE: "Story photo",
  STORY_VIDEO: "Story video",
  AVATAR: "Profile picture",
};

export function purposeText(purpose: UploadPurpose | null): string | null {
  return purpose ? PURPOSE_TEXT[purpose] : null;
}
