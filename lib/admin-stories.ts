import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getStoredTokens } from "./api";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { refreshSiteContent } from "./site-content.actions";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminStory = Schemas["AdminStory"];
export type AdminStoryPage = Schemas["AdminStoryPage"];
export type StoryStatus = AdminStory["status"];
export type StoryRole = "STUDENT" | "TUTOR";
export type ModerateStoryInput = Schemas["ModerateStoryInput"];

export type StoryFilters = { status: StoryStatus; role?: StoryRole };

export const adminStoryApi = {
  list: (filters: StoryFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/stories", {
        params: {
          query: { status: filters.status, role: filters.role, cursor },
        },
      }),
    ),
  moderate: (id: string, body: ModerateStoryInput) =>
    unwrap(
      client.POST("/api/v1/admin/stories/{id}/moderate", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminStories(filters: StoryFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.stories(filters),
    queryFn: ({ pageParam }) => adminStoryApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/**
 * An approve or reject. Rejecting a story that a landing card uses takes it off the home page,
 * so the site content lists refetch too.
 */
export function useModerateStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ModerateStoryInput }) =>
      adminStoryApi.moderate(id, body),
    // A rejection can take a card off the landing; refresh it now instead of within 5 minutes.
    onSuccess: async (_story, { body }) => {
      const tokens = getStoredTokens();
      if (body.decision !== "REJECT" || !tokens) return;
      await refreshSiteContent(tokens.accessToken).catch(() => false);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.storiesAll }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.siteContent,
        }),
      ]),
  });
}

type Tone = "neutral" | "warning" | "success" | "error";

export const STORY_STATUS_META: Record<
  StoryStatus,
  { label: string; tone: Tone }
> = {
  PENDING: { label: "Waiting for review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "error" },
};

/** Author role as the admin list shows it. */
export function roleText(role: AdminStory["role"]): string {
  if (role === "STUDENT") return "Student";
  if (role === "TUTOR") return "Tutor";
  return "Admin";
}
