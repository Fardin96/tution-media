import type { QueryClient } from "@tanstack/react-query";

export type RequirementStatus = "active" | "archived" | "all";

export const queryKeys = {
  me: ["me"] as const,
  match: ["match"] as const,
  tutor: {
    requirements: {
      all: ["tutor", "requirements"] as const,
      list: (status: RequirementStatus = "active") =>
        ["tutor", "requirements", { status }] as const,
      detail: (id: string) => ["tutor", "requirements", id] as const,
    },
    zones: ["tutor", "zones"] as const,
    zoneRequests: ["tutor", "zone-requests"] as const,
    profileSubjects: ["tutor", "profile-subjects"] as const,
  },
  packages: { mine: ["packages", "mine"] as const },
  lookups: { education: ["lookups", "education"] as const },
};

/** Every tutor-requirement mutation invalidates the same keys; the prefix covers all status lists and details. */
export function invalidateTutorRequirements(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.tutor.requirements.all,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    queryClient.invalidateQueries({ queryKey: queryKeys.match }),
  ]);
}
