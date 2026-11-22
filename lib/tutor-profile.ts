import { useQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { ApiError } from "./profile";

// Public tutor profile (GET /api/v1/tutors/{id}). The API hides unlisted tutors from strangers (404).
export type PublicTutor = Schemas["TutorPublicProfile"];
export type PublicTutorVideo = PublicTutor["videos"][number];

export const tutorProfileApi = {
  get: async (id: string): Promise<PublicTutor> =>
    (
      await unwrap(
        client.GET("/api/v1/tutors/{id}", { params: { path: { id } } }),
      )
    ).tutor,
};

/**
 * `initialData` is the anonymous copy the server rendered. A signed-in viewer refetches at once
 * with their token (`initialDataUpdatedAt: 0` marks the copy stale); anonymous visitors use it
 * until it is stale.
 */
export function useTutorProfile(
  id: string,
  options?: { initialData?: PublicTutor; signedIn?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.tutors.profile(id),
    queryFn: () => tutorProfileApi.get(id),
    staleTime: 60_000,
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.signedIn ? 0 : undefined,
    // A missing or unlisted tutor is final; only server and network errors are retried.
    retry: (failureCount, err) =>
      failureCount < 2 &&
      !(err instanceof ApiError && err.status >= 400 && err.status < 500),
  });
}

const MEMBER_SINCE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/** "November 2026" in Dhaka time, for "Member since". */
export function formatMemberSince(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : MEMBER_SINCE_FORMAT.format(date);
}
