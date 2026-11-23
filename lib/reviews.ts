import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { invalidateApplications, queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type MyReview = Schemas["MyReview"];
export type CreateReviewInput = Schemas["CreateReviewInput"];
export type UpdateReviewInput = Schemas["UpdateReviewInput"];
export type TutorReview = Schemas["TutorReview"];
export type StudentReview = Schemas["StudentReview"];
export type ReviewSummary = Schemas["ReviewSummary"];

/** One review as the list shows it, whichever side wrote it. */
export type ListedReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type ReviewListPage = {
  reviews: ListedReview[];
  summary: ReviewSummary;
};

export const REVIEW_COMMENT_MAX = 1000;

export const RATING_LABEL: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

export const reviewApi = {
  mine: (applicationId?: string, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/reviews/mine", {
        params: { query: { applicationId, cursor } },
      }),
    ),
  create: (body: CreateReviewInput) =>
    unwrap(client.POST("/api/v1/reviews", { body })),
  update: (id: string, body: UpdateReviewInput) =>
    unwrap(
      client.PATCH("/api/v1/reviews/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
  forTutor: (tutorId: string, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/tutors/{id}/reviews", {
        params: { path: { id: tutorId }, query: { cursor } },
      }),
    ),
  forStudent: (studentId: string, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/students/{id}/reviews", {
        params: { path: { id: studentId }, query: { cursor } },
      }),
    ),
};

/** The caller's review for this application's pair, or null when there is none yet. */
export function useMyReview(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reviews.mine(applicationId),
    queryFn: async () => {
      const page = await reviewApi.mine(applicationId);
      return page.reviews[0] ?? null;
    },
    enabled,
    staleTime: 15_000,
  });
}

/** A review write changes the review lists and the rating shown on applications and browse cards. */
function invalidateReviews(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
    invalidateApplications(queryClient),
  ]);
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation<MyReview, ApiError, CreateReviewInput>({
    mutationFn: (body) => reviewApi.create(body),
    onSettled: () => invalidateReviews(queryClient),
  });
}

export function useUpdateReview(id: string) {
  const queryClient = useQueryClient();
  return useMutation<MyReview, ApiError, UpdateReviewInput>({
    mutationFn: (body) => reviewApi.update(id, body),
    onSettled: () => invalidateReviews(queryClient),
  });
}

export function useTutorReviews(tutorId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.reviews.tutor(tutorId),
    queryFn: async ({
      pageParam,
    }): Promise<ReviewListPage & { next?: string }> => {
      const page = await reviewApi.forTutor(tutorId, pageParam);
      return {
        summary: page.summary,
        next: page.nextCursor ?? undefined,
        reviews: page.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          authorName: r.student.name,
          authorAvatarUrl: r.student.avatarUrl,
        })),
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next,
    staleTime: 30_000,
  });
}

export function useStudentReviews(studentId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.reviews.student(studentId),
    queryFn: async ({
      pageParam,
    }): Promise<ReviewListPage & { next?: string }> => {
      const page = await reviewApi.forStudent(studentId, pageParam);
      return {
        summary: page.summary,
        next: page.nextCursor ?? undefined,
        reviews: page.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          authorName: r.tutor.name,
          authorAvatarUrl: r.tutor.avatarUrl,
        })),
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next,
    staleTime: 30_000,
  });
}

export type ReviewErrors = { rating?: string; comment?: string };

/** Rating is required (1 to 5). The comment is optional, up to REVIEW_COMMENT_MAX characters. */
export function validateReview(input: {
  rating: number;
  comment: string;
}): ReviewErrors {
  const errors: ReviewErrors = {};
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    errors.rating = "Pick a rating from 1 to 5 stars.";
  }
  if (input.comment.trim().length > REVIEW_COMMENT_MAX) {
    errors.comment = `Keep your comment under ${REVIEW_COMMENT_MAX} characters.`;
  }
  return errors;
}

/** "4.5 (12 reviews)", or "New" when nobody has rated yet. */
export function ratingText(avg: number, count: number): string {
  if (count <= 0) return "New";
  return `${avg.toFixed(1)} (${count} ${count === 1 ? "review" : "reviews"})`;
}
