import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getStoredTokens } from "./api";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";
import { refreshTutorProfilesAsAdmin } from "./tutor-profile.actions";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminReview = Schemas["AdminReview"];
export type ReviewStatus = AdminReview["status"];
export type ReviewDirection = AdminReview["direction"];

export interface AdminReviewFilters {
  status?: ReviewStatus;
  direction?: ReviewDirection;
  rating?: number;
}

export const adminReviewsApi = {
  list: (filters: AdminReviewFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/reviews", {
        params: {
          query: {
            status: filters.status,
            direction: filters.direction,
            rating: filters.rating,
            cursor,
          },
        },
      }),
    ),
  moderate: (id: string, body: Schemas["ModerateReviewInput"]) =>
    unwrap(
      client.PATCH("/api/v1/admin/reviews/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminReviews(filters: AdminReviewFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.reviews(filters),
    queryFn: ({ pageParam }) => adminReviewsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export interface ModerateReviewVariables {
  id: string;
  status: ReviewStatus;
  note: string;
}

/**
 * Expires the cached public tutor pages after a moderation that changes them. Fire-and-forget:
 * the admin's change has already succeeded, so a failed refresh is dropped.
 */
async function refreshPublicTutors(): Promise<void> {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await refreshTutorProfilesAsAdmin(tokens.accessToken);
  } catch {
    // The public profile catches up within 60 seconds anyway.
  }
}

/** Hides or restores a review. Refreshes the admin lists and the public rating screens. */
export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation<AdminReview, ApiError, ModerateReviewVariables>({
    mutationFn: ({ id, status, note }) =>
      adminReviewsApi.moderate(id, { status, note }),
    onSuccess: () => {
      void refreshPublicTutors();
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.reviewsAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
      ]),
  });
}

export const REVIEW_STATUS_META: Record<
  ReviewStatus,
  { label: string; tone: "success" | "neutral" }
> = {
  VISIBLE: { label: "Visible", tone: "success" },
  HIDDEN: { label: "Hidden", tone: "neutral" },
};

export const REVIEW_DIRECTION_LABEL: Record<ReviewDirection, string> = {
  STUDENT_TO_TUTOR: "Student reviewed tutor",
  TUTOR_TO_STUDENT: "Tutor reviewed student",
};

/** Who wrote the review and who it is about, by direction. */
export function reviewParties(review: AdminReview): {
  author: string;
  subject: string;
} {
  return review.direction === "STUDENT_TO_TUTOR"
    ? { author: review.student.name, subject: review.tutor.name }
    : { author: review.tutor.name, subject: review.student.name };
}

export const REVIEW_NOTE_MIN = 3;
export const REVIEW_NOTE_MAX = 500;

/** Inline message for a moderation note (3 to 500 characters after trimming), or undefined. */
export function validateReviewNote(text: string): string | undefined {
  const length = text.trim().length;
  if (length < REVIEW_NOTE_MIN) return "Write at least 3 characters.";
  if (length > REVIEW_NOTE_MAX) {
    return `Keep it to ${REVIEW_NOTE_MAX} characters or fewer.`;
  }
  return undefined;
}
