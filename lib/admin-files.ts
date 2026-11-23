import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getStoredTokens } from "./api";
import { client, unwrap, type Schemas } from "./api-client";
import type { FilePurpose } from "./files";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";
import { refreshSiteContent } from "./site-content.actions";
import { refreshTutorProfilesAsAdmin } from "./tutor-profile.actions";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminFile = Schemas["AdminFile"];
export type AdminFileStats = Schemas["AdminFileStats"];
export type AdminFileStatsGroup = AdminFileStats["groups"][number];
export type FileStatus = AdminFile["status"];
export type RemoveFileInput = Schemas["RemoveFileInput"];
export type IdStatus = Schemas["AdminTutorVerification"]["status"];

/** The file a removal dialog is about. `idStatus` is set only when the page knows the ID's status. */
export interface RemoveFileTarget {
  fileId: string;
  fileName: string | null;
  purpose: FilePurpose;
  idStatus?: IdStatus;
}

export interface AdminFileFilters {
  purpose?: FilePurpose;
  status?: FileStatus;
  /** true lists files no record uses. */
  unattached?: boolean;
}

export const PURPOSE_LABEL: Record<FilePurpose, string> = {
  STUDENT_ID: "Student ID",
  TUTOR_ID: "Tutor ID",
  CREDENTIAL: "Credential",
  TUTOR_VIDEO: "Video",
  BLOG_COVER: "Blog cover",
  SITE_IMAGE: "Site image",
  SITE_VIDEO: "Site video",
  STORY_IMAGE: "Story photo",
  STORY_VIDEO: "Story video",
  AVATAR: "Profile picture",
};

export const FILE_PURPOSES: readonly FilePurpose[] = [
  "STUDENT_ID",
  "TUTOR_ID",
  "CREDENTIAL",
  "TUTOR_VIDEO",
  "BLOG_COVER",
  "SITE_IMAGE",
  "SITE_VIDEO",
  "STORY_IMAGE",
  "STORY_VIDEO",
];

export const FILE_STATUS_LABEL: Record<FileStatus, string> = {
  PENDING_UPLOAD: "Pending",
  UPLOADED: "Uploaded",
  DELETED: "Deleted",
};

export const adminFileApi = {
  list: (filters: AdminFileFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/files", {
        params: {
          query: {
            purpose: filters.purpose,
            status: filters.status,
            unattached:
              filters.unattached === undefined
                ? undefined
                : filters.unattached
                  ? "true"
                  : "false",
            cursor,
          },
        },
      }),
    ),
  stats: () => unwrap(client.GET("/api/v1/admin/files/stats")),
  remove: (id: string) =>
    unwrap(
      client.DELETE("/api/v1/admin/files/{id}", { params: { path: { id } } }),
    ),
  /** Removes a file a record uses, with a note the user may see. */
  removeFile: (id: string, body: RemoveFileInput) =>
    unwrap(
      client.POST("/api/v1/admin/files/{id}/remove", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminFiles(filters: AdminFileFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.files(filters),
    queryFn: ({ pageParam }) => adminFileApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminFileStats() {
  return useQuery({
    queryKey: queryKeys.admin.fileStats,
    queryFn: adminFileApi.stats,
    staleTime: 15_000,
  });
}

/**
 * A file in use that an admin can remove with a note: uploaded, linked to a record, not a blog
 * cover or a site image/video (the API refuses both; the admin replaces them in Site content).
 */
export function canRemoveFile(file: AdminFile): boolean {
  return (
    file.status === "UPLOADED" &&
    file.inUse &&
    file.purpose !== "BLOG_COVER" &&
    file.purpose !== "SITE_IMAGE" &&
    file.purpose !== "SITE_VIDEO"
  );
}

/** Only an ID can lose its verified status, and only when the page knows it is approved. */
export function showUnverifyOption(target: RemoveFileTarget): boolean {
  return (
    (target.purpose === "TUTOR_ID" || target.purpose === "STUDENT_ID") &&
    target.idStatus === "APPROVED"
  );
}

/** What the removal does, shown above the note form. */
export function removeFileText(target: RemoveFileTarget): string {
  if (target.purpose === "TUTOR_VIDEO") {
    return "The video is deleted from their profile.";
  }
  if (target.purpose === "CREDENTIAL") {
    return "The certificate is deleted from their profile.";
  }
  if (target.purpose === "BLOG_COVER") {
    return "The blog cover is deleted.";
  }
  switch (target.idStatus) {
    case "PENDING":
      return "The ID is rejected and the user can upload a new one.";
    case "APPROVED":
      return "The ID file is deleted. They stay verified unless you tick the box below.";
    case "REJECTED":
      return "The ID file is deleted. The user can upload a new one.";
    default:
      return "A pending ID is rejected and the user can upload a new one. An approved ID stays verified.";
  }
}

/**
 * A removed file may be in use on the landing, so ask the server to expire the landing cache now. Failure is ignored: the landing catches up within
 * 30 minutes anyway.
 */
async function refreshLanding() {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await refreshSiteContent(tokens.accessToken);
  } catch {
    // The landing refreshes within 30 minutes anyway.
  }
}

/**
 * A removed file can be a tutor's video or credential, so the cached public tutor pages expire
 * too. Fire-and-forget like the landing refresh.
 */
async function refreshPublicTutors() {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await refreshTutorProfilesAsAdmin(tokens.accessToken);
  } catch {
    // The public profile catches up within 60 seconds anyway.
  }
}

export function useRemoveFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, body }: { fileId: string; body: RemoveFileInput }) =>
      adminFileApi.removeFile(fileId, body),
    onSuccess: () => {
      void refreshLanding();
      void refreshPublicTutors();
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.verificationsAll,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.videosAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.filesAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.fileStats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.uploadsAll }),
        // Account pages show the photo, so a removed avatar must drop off them too.
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.accountsAll,
        }),
      ]),
  });
}

export function useDeleteAdminFile() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => adminFileApi.remove(id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.filesAll }),
  });
}

export interface PurposeSummary {
  purpose: FilePurpose;
  label: string;
  /** UPLOADED files only. */
  uploadedCount: number;
  uploadedBytes: number;
  pendingCount: number;
  deletedCount: number;
}

/**
 * One row per purpose, in FILE_PURPOSES order, from the stats groups. A purpose with no rows
 * is all zeros. Only UPLOADED files count toward the size; pending and deleted are counts.
 */
export function summarizeStats(
  groups: readonly AdminFileStatsGroup[],
): PurposeSummary[] {
  return FILE_PURPOSES.map((purpose) => {
    const summary: PurposeSummary = {
      purpose,
      label: PURPOSE_LABEL[purpose],
      uploadedCount: 0,
      uploadedBytes: 0,
      pendingCount: 0,
      deletedCount: 0,
    };
    for (const group of groups) {
      if (group.purpose !== purpose) continue;
      if (group.status === "UPLOADED") {
        summary.uploadedCount += group.count;
        summary.uploadedBytes += group.totalBytes;
      } else if (group.status === "PENDING_UPLOAD") {
        summary.pendingCount += group.count;
      } else if (group.status === "DELETED") {
        summary.deletedCount += group.count;
      }
    }
    return summary;
  });
}
