import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";
import type { Tone } from "./requirements";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type MyReport = Schemas["MyReport"];
export type MyDispute = Schemas["MyDispute"];
export type CreateReportInput = Schemas["CreateReportInput"];
export type CreateDisputeInput = Schemas["CreateDisputeInput"];
export type ReportCategory = CreateReportInput["category"];
export type DisputeType = CreateDisputeInput["type"];
export type CaseStatus = MyReport["status"];

export const caseApi = {
  reportMine: (cursor?: string) =>
    unwrap(
      client.GET("/api/v1/reports/mine", { params: { query: { cursor } } }),
    ),
  report: (body: CreateReportInput) =>
    unwrap(client.POST("/api/v1/reports", { body })),
  disputeMine: (applicationId?: string, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/disputes/mine", {
        params: { query: { applicationId, cursor } },
      }),
    ),
  dispute: (body: CreateDisputeInput) =>
    unwrap(client.POST("/api/v1/disputes", { body })),
};

export function useMyReports() {
  return useInfiniteQuery({
    queryKey: queryKeys.cases.reports,
    queryFn: ({ pageParam }) => caseApi.reportMine(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/** The caller's disputes, all of them or only those of one application. */
export function useMyDisputes(applicationId?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.cases.disputes(applicationId),
    queryFn: ({ pageParam }) => caseApi.disputeMine(applicationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
    enabled,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation<MyReport, ApiError, CreateReportInput>({
    mutationFn: caseApi.report,
    // A 409 means one already exists, so refresh on error too.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export function useCreateDispute() {
  const queryClient = useQueryClient();
  return useMutation<MyDispute, ApiError, CreateDisputeInput>({
    mutationFn: caseApi.dispute,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.all }),
  });
}

export const CASE_DETAILS_MIN = 10;
export const CASE_DETAILS_MAX = 2000;

export const REPORT_CATEGORY_ORDER: ReportCategory[] = [
  "ABUSE",
  "INAPPROPRIATE_CONTENT",
  "OFF_PLATFORM_CONTACT",
  "NO_SHOW",
  "FAKE_PROFILE",
  "SPAM",
  "OTHER",
];

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  ABUSE: "Abuse or harassment",
  FAKE_PROFILE: "Fake profile",
  SPAM: "Spam",
  NO_SHOW: "Didn't show up",
  OFF_PLATFORM_CONTACT: "Asked to deal off the platform",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  OTHER: "Something else",
};

export const REPORT_CATEGORY_HINT: Record<ReportCategory, string> = {
  ABUSE: "Threats, insults or harassment.",
  FAKE_PROFILE: "The details or photo aren't real.",
  SPAM: "Unwanted or repeated messages.",
  NO_SHOW: "Missed a session without notice.",
  OFF_PLATFORM_CONTACT: "Pushed to pay or talk outside the platform.",
  INAPPROPRIATE_CONTENT: "Offensive or unsuitable material.",
  OTHER: "Anything the options above don't cover.",
};

export const DISPUTE_TYPE_ORDER: DisputeType[] = [
  "NO_SHOW",
  "QUALITY",
  "PAYMENT",
  "SCHEDULE",
  "OTHER",
];

export const DISPUTE_TYPE_LABEL: Record<DisputeType, string> = {
  NO_SHOW: "No-show",
  QUALITY: "Quality of teaching",
  PAYMENT: "Payment",
  SCHEDULE: "Schedule",
  OTHER: "Something else",
};

export const DISPUTE_TYPE_HINT: Record<DisputeType, string> = {
  NO_SHOW: "Sessions were missed.",
  QUALITY: "The teaching isn't what was agreed.",
  PAYMENT: "A disagreement about money.",
  SCHEDULE: "Days or times keep changing.",
  OTHER: "Anything else about this tuition.",
};

export const CASE_STATUS_META: Record<
  CaseStatus,
  { label: string; tone: Tone }
> = {
  OPEN: { label: "Received", tone: "info" },
  UNDER_REVIEW: { label: "Being looked at", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  DISMISSED: { label: "Closed", tone: "neutral" },
};

/** A case with no outcome yet. */
export function isCaseActive(status: CaseStatus) {
  return status === "OPEN" || status === "UNDER_REVIEW";
}

/** Inline message for report or dispute details (10 to 2000 characters after trimming), or undefined. */
export function validateCaseDetails(text: string): string | undefined {
  const length = text.trim().length;
  if (length < CASE_DETAILS_MIN) {
    return `Write at least ${CASE_DETAILS_MIN} characters.`;
  }
  if (length > CASE_DETAILS_MAX) {
    return `Keep it to ${CASE_DETAILS_MAX} characters or fewer.`;
  }
  return undefined;
}
