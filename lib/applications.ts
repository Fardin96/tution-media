import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { queryKeys, invalidateApplications } from "./query-keys";
import type { Tone } from "./requirements";

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

export function useApplication(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => applicationApi.get(id),
    staleTime: 15_000,
  });
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
