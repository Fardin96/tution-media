import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  queryOptions,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { queryKeys, invalidateApplications } from "./query-keys";
import { requirementApi, type Tone } from "./requirements";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type Application = Schemas["Application"];
export type ApplicationDetail = Schemas["ApplicationDetail"];
export type ApplicationPage = Schemas["ApplicationPage"];
export type ApplicationTarget = Schemas["ApplicationTarget"];
export type ApplicationFee = Schemas["ApplicationFee"];
export type ApplicationContact = Schemas["ApplicationContact"];
export type ApplicationTutorProfile = Schemas["ApplicationTutorProfile"];
export type ApplicationTutorSet = Schemas["ApplicationTutorSet"];
export type ApplicationStatus = Application["status"];
export type ApplicationAction = Application["allowedActions"][number];
export type RecommendedTutorPage = Schemas["RecommendedTutorPage"];
export type RecommendedTutor = RecommendedTutorPage["tutors"][number];
export type RecommendedSuggestion = RecommendedTutorPage["suggestions"][number];
export type RequirementInvite = Schemas["RequirementInvite"];

export const APPLICATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
  "CANCELLED",
  "EXPIRED",
] as const satisfies readonly ApplicationStatus[];

export const APPLICATION_ACTIONS = [
  "confirm",
  "reject",
  "withdraw",
  "reopen",
  "cancel",
  "complete",
] as const satisfies readonly ApplicationAction[];

export const applicationApi = {
  list: (q: { status?: ApplicationStatus; cursor?: string }) =>
    unwrap(client.GET("/api/v1/applications", { params: { query: q } })),
  get: (id: string) =>
    unwrap(
      client.GET("/api/v1/applications/{id}", { params: { path: { id } } }),
    ),
  forRequirement: (requirementId: string, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/requirements/{id}/applications", {
        params: { path: { id: requirementId }, query: { cursor } },
      }),
    ),
  forPackage: (packageId: string, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/packages/{id}/applications", {
        params: { path: { id: packageId }, query: { cursor } },
      }),
    ),
  apply: (requirementId: string) =>
    unwrap(
      client.POST("/api/v1/requirements/{id}/applications", {
        params: { path: { id: requirementId } },
      }),
    ),
  requestPackage: (packageId: string) =>
    unwrap(
      client.POST("/api/v1/packages/{id}/applications", {
        params: { path: { id: packageId } },
      }),
    ),
  act: (id: string, action: ApplicationAction): Promise<ApplicationDetail> => {
    const path = { params: { path: { id } } };
    switch (action) {
      case "confirm":
        return unwrap(client.POST("/api/v1/applications/{id}/confirm", path));
      case "reject":
        return unwrap(client.POST("/api/v1/applications/{id}/reject", path));
      case "withdraw":
        return unwrap(client.POST("/api/v1/applications/{id}/withdraw", path));
      case "reopen":
        return unwrap(client.POST("/api/v1/applications/{id}/reopen", path));
      case "cancel":
        return unwrap(client.POST("/api/v1/applications/{id}/cancel", path));
      case "complete":
        return unwrap(client.POST("/api/v1/applications/{id}/complete", path));
    }
  },
};

export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; tone: Tone }
> = {
  PENDING: { label: "Pending", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  COMPLETED: { label: "Completed", tone: "info" },
  REJECTED: { label: "Not selected", tone: "neutral" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "error" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

export interface ActionConfirm {
  title: string;
  body: string;
  confirmLabel: string;
  destructive: boolean;
}

export const ACTION_META: Record<
  ApplicationAction,
  {
    label: string;
    pending: string;
    done: string;
    confirm: null | ActionConfirm;
  }
> = {
  confirm: {
    label: "Accept",
    pending: "Accepting…",
    done: "Application accepted.",
    confirm: {
      title: "Accept this application?",
      body: "The other applicants will be told the position is filled. The tutor gets your contact details.",
      confirmLabel: "Accept",
      destructive: false,
    },
  },
  reject: {
    label: "Decline",
    pending: "Declining…",
    done: "Application declined.",
    confirm: {
      title: "Decline this application?",
      body: "The other side will be told you have declined.",
      confirmLabel: "Decline",
      destructive: true,
    },
  },
  withdraw: {
    label: "Withdraw",
    pending: "Withdrawing…",
    done: "Application withdrawn.",
    confirm: {
      title: "Withdraw your application?",
      body: "The other side will be told you have withdrawn.",
      confirmLabel: "Withdraw",
      destructive: true,
    },
  },
  reopen: {
    label: "Apply again",
    pending: "Applying again…",
    done: "Application sent again.",
    confirm: null,
  },
  cancel: {
    label: "Cancel tuition",
    pending: "Cancelling…",
    done: "Tuition cancelled.",
    confirm: {
      title: "Cancel this tuition?",
      body: "Both sides will see it as cancelled. A placement fee that is still due will be voided.",
      confirmLabel: "Cancel tuition",
      destructive: true,
    },
  },
  complete: {
    label: "Mark as finished",
    pending: "Saving…",
    done: "Marked as finished.",
    confirm: {
      title: "Mark this tuition as finished?",
      body: "This ends the arrangement.",
      confirmLabel: "Mark as finished",
      destructive: false,
    },
  },
};

/** Student side of a requirement: recommendations and invites. The API answers 409 LISTING_NOT_OPEN once it is no longer OPEN. */
export const recommendationApi = {
  tutors: (
    requirementId: string,
    page: number,
  ): Promise<RecommendedTutorPage> =>
    unwrap(
      client.GET("/api/v1/requirements/{id}/tutors", {
        params: { path: { id: requirementId }, query: { page } },
      }),
    ),
  invite: (
    requirementId: string,
    tutorId: string,
  ): Promise<RequirementInvite> =>
    unwrap(
      client.POST("/api/v1/requirements/{id}/invites", {
        params: { path: { id: requirementId } },
        body: { tutorId },
      }),
    ),
};

/** The student's own requirement. Only its status is read here, to decide whether the tutor list applies. */
export const studentRequirementQueryOptions = (requirementId: string) =>
  queryOptions({
    queryKey: queryKeys.applications.studentRequirement(requirementId),
    queryFn: () => requirementApi.get(requirementId),
    staleTime: 15_000,
  });

export function useStudentRequirement(requirementId: string) {
  return useQuery(studentRequirementQueryOptions(requirementId));
}

export function useRecommendedTutors(requirementId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.applications.recommended(requirementId),
    queryFn: ({ pageParam }) =>
      recommendationApi.tutors(requirementId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
    staleTime: 15_000,
  });
}

/**
 * Sets invitedAt on the tutor's row at once, so the button reads Invited before the list refetches.
 * A repeat invite answers 409 INVITE_EXISTS, which shows as an error; the refetch then shows the invite.
 */
export function useInviteTutor(requirementId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.applications.recommended(requirementId);
  return useMutation<RequirementInvite, ApiError, string>({
    mutationFn: (tutorId) => recommendationApi.invite(requirementId, tutorId),
    onSuccess: (invite, tutorId) => {
      queryClient.setQueriesData<InfiniteData<RecommendedTutorPage>>(
        { queryKey: key },
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              tutors: page.tutors.map((row) =>
                row.tutor.id === tutorId
                  ? { ...row, invitedAt: invite.createdAt }
                  : row,
              ),
            })),
          },
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useMyApplications(status?: ApplicationStatus) {
  return useInfiniteQuery({
    queryKey: queryKeys.applications.list(status),
    queryFn: ({ pageParam }) =>
      applicationApi.list({ status, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export const applicationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => applicationApi.get(id),
    staleTime: 15_000,
  });

export function useApplication(id: string) {
  return useQuery(applicationQueryOptions(id));
}

export function useRequirementApplicants(requirementId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.applications.forRequirement(requirementId),
    queryFn: ({ pageParam }) =>
      applicationApi.forRequirement(requirementId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useApplicationAction() {
  const queryClient = useQueryClient();
  return useMutation<
    ApplicationDetail,
    ApiError,
    { id: string; action: ApplicationAction }
  >({
    mutationFn: ({ id, action }) => applicationApi.act(id, action),
    onSettled: () => invalidateApplications(queryClient),
  });
}

function isAlreadyApplied(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as ApiError).code === "ALREADY_APPLIED"
  );
}

/** A repeat apply resolves to null: the tutor already has an application, which the page treats as success. */
export function useApplyToRequirement() {
  const queryClient = useQueryClient();
  return useMutation<ApplicationDetail | null, ApiError, string>({
    mutationFn: async (requirementId) => {
      try {
        return await applicationApi.apply(requirementId);
      } catch (err) {
        if (isAlreadyApplied(err)) return null;
        throw err;
      }
    },
    onSettled: () => invalidateApplications(queryClient),
  });
}

/** A repeat request resolves to null, the same as a repeat apply. */
export function useRequestPackage() {
  const queryClient = useQueryClient();
  return useMutation<ApplicationDetail | null, ApiError, string>({
    mutationFn: async (packageId) => {
      try {
        return await applicationApi.requestPackage(packageId);
      } catch (err) {
        if (isAlreadyApplied(err)) return null;
        throw err;
      }
    },
    onSettled: () => invalidateApplications(queryClient),
  });
}
