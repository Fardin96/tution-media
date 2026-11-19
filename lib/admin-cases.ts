import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminReport = Schemas["AdminReport"];
export type AdminReportDetail = Schemas["AdminReportDetail"];
export type AdminDispute = Schemas["AdminDispute"];
export type AdminDisputeDetail = Schemas["AdminDisputeDetail"];
export type AdminParty = Schemas["AdminParty"];
export type CaseAction = Schemas["CaseActionInput"]["action"];
export type CaseStatus = AdminReport["status"];
export type ReportCategory = AdminReport["category"];
export type DisputeType = AdminDispute["type"];
export type CaseQueue = "open" | "closed";

export interface AdminReportFilters {
  queue: CaseQueue;
  category?: ReportCategory;
}

export interface AdminDisputeFilters {
  queue: CaseQueue;
  type?: DisputeType;
}

export interface CaseActionVariables {
  action: CaseAction;
  note?: string;
}

export const adminCasesApi = {
  reports: (filters: AdminReportFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/reports", {
        params: {
          query: {
            queue: filters.queue,
            category: filters.category,
            cursor,
          },
        },
      }),
    ),
  report: (id: string) =>
    unwrap(
      client.GET("/api/v1/admin/reports/{id}", { params: { path: { id } } }),
    ),
  actOnReport: (id: string, body: CaseActionVariables) =>
    unwrap(
      client.PATCH("/api/v1/admin/reports/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
  disputes: (filters: AdminDisputeFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/disputes", {
        params: {
          query: { queue: filters.queue, type: filters.type, cursor },
        },
      }),
    ),
  dispute: (id: string) =>
    unwrap(
      client.GET("/api/v1/admin/disputes/{id}", { params: { path: { id } } }),
    ),
  actOnDispute: (id: string, body: CaseActionVariables) =>
    unwrap(
      client.PATCH("/api/v1/admin/disputes/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminReports(filters: AdminReportFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.reports(filters),
    queryFn: ({ pageParam }) => adminCasesApi.reports(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminReport(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.report(id),
    queryFn: () => adminCasesApi.report(id),
    staleTime: 15_000,
  });
}

export function useAdminDisputes(filters: AdminDisputeFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.disputes(filters),
    queryFn: ({ pageParam }) => adminCasesApi.disputes(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminDispute(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.dispute(id),
    queryFn: () => adminCasesApi.dispute(id),
    staleTime: 15_000,
  });
}

/** Writes the server's report detail into the cache, then refreshes the lists. The user's own case lists change too. */
export function useReportAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation<AdminReportDetail, ApiError, CaseActionVariables>({
    mutationFn: (body) => adminCasesApi.actOnReport(id, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.admin.report(detail.id), detail);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.reportsAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.all }),
      ]),
  });
}

export function useDisputeAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation<AdminDisputeDetail, ApiError, CaseActionVariables>({
    mutationFn: (body) => adminCasesApi.actOnDispute(id, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.admin.dispute(detail.id), detail);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.disputesAll,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.all }),
      ]),
  });
}

export const CASE_STATUS_META: Record<
  CaseStatus,
  { label: string; tone: "warning" | "info" | "success" | "neutral" }
> = {
  OPEN: { label: "Open", tone: "warning" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
  DISMISSED: { label: "Dismissed", tone: "neutral" },
};

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  ABUSE: "Abuse",
  FAKE_PROFILE: "Fake profile",
  SPAM: "Spam",
  NO_SHOW: "No-show",
  OFF_PLATFORM_CONTACT: "Contact outside the platform",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  OTHER: "Other",
};

export const DISPUTE_TYPE_LABEL: Record<DisputeType, string> = {
  NO_SHOW: "No-show",
  QUALITY: "Quality",
  PAYMENT: "Payment",
  SCHEDULE: "Schedule",
  OTHER: "Other",
};

export const APPLICATION_STATUS_LABEL: Record<
  NonNullable<AdminReportDetail["application"]>["status"],
  string
> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const ROLE_LABEL: Record<AdminParty["role"], string> = {
  STUDENT: "Student",
  TUTOR: "Tutor",
  ADMIN: "Admin",
};

export const ACCOUNT_STATUS_LABEL: Record<AdminParty["status"], string> = {
  ACTIVE: "Active",
  BLOCKED: "Blocked",
  DELETED: "Deleted",
};

/** A party's name, or their email when they never set one. */
export function partyName(party: AdminParty): string {
  return party.name?.trim() || party.email;
}

/** True while a case still needs an admin (OPEN or UNDER_REVIEW). */
export function isCaseOpen(status: CaseStatus): boolean {
  return status === "OPEN" || status === "UNDER_REVIEW";
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "always" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "3 days ago", "5 hours ago", "just now". Rounds down. Future dates read as "just now". */
export function ageText(value: string, now: number = Date.now()): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diff = now - then;
  for (const [unit, size] of STEPS) {
    if (diff >= size) return RELATIVE.format(-Math.floor(diff / size), unit);
  }
  return "just now";
}

export const CASE_NOTE_MIN = 3;
export const CASE_NOTE_MAX = 500;

/** Inline message for a resolve or dismiss note (3 to 500 characters after trimming), or undefined. */
export function validateCaseNote(text: string): string | undefined {
  const length = text.trim().length;
  if (length < CASE_NOTE_MIN) return "Write at least 3 characters.";
  if (length > CASE_NOTE_MAX) {
    return `Keep it to ${CASE_NOTE_MAX} characters or fewer.`;
  }
  return undefined;
}
