import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminTutorVerification = Schemas["AdminTutorVerification"];
export type AdminStudentVerification = Schemas["AdminStudentVerification"];
export type DecideVerificationInput = Schemas["DecideVerificationInput"];
export type VerificationRecordStatus = AdminTutorVerification["status"];
export type VerificationKind = "tutors" | "students";
/** The statuses the review queue can be filtered to. */
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * One row of either queue, flattened so the page renders tutors and students the same way.
 * `decideId` is what the decide endpoint takes: the verification id for tutors, the student id
 * for students.
 */
export type VerificationRow = {
  kind: VerificationKind;
  decideId: string;
  name: string;
  institute: string | null;
  studentIdNumber: string | null;
  submittedAt: string | null;
  status: VerificationRecordStatus;
  note: string | null;
  file: Schemas["FileAsset"] | null;
};

export type VerificationPage = {
  rows: VerificationRow[];
  nextCursor: string | null;
};

export const adminVerificationApi = {
  listTutors: (status: VerificationStatus, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/verifications/tutors", {
        params: { query: { status, cursor } },
      }),
    ),
  listStudents: (status: VerificationStatus, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/verifications/students", {
        params: { query: { status, cursor } },
      }),
    ),
  decideTutor: (id: string, body: DecideVerificationInput) =>
    unwrap(
      client.POST("/api/v1/admin/verifications/tutors/{id}/decide", {
        params: { path: { id } },
        body,
      }),
    ),
  decideStudent: (id: string, body: DecideVerificationInput) =>
    unwrap(
      client.POST("/api/v1/admin/verifications/students/{id}/decide", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function tutorRows(
  page: Schemas["AdminTutorVerificationPage"],
): VerificationRow[] {
  return page.verifications.map((v) => ({
    kind: "tutors",
    decideId: v.id,
    name: v.tutor.name,
    institute: v.tutor.instituteName,
    studentIdNumber: v.tutor.studentIdNumber,
    submittedAt: v.submittedAt,
    status: v.status,
    note: v.note,
    file: v.file,
  }));
}

export function studentRows(
  page: Schemas["AdminStudentVerificationPage"],
): VerificationRow[] {
  return page.verifications.map((v) => ({
    kind: "students",
    decideId: v.studentId,
    name: v.student.name,
    institute: null,
    studentIdNumber: v.student.studentIdNumber,
    submittedAt: v.submittedAt,
    status: v.status,
    note: v.note,
    file: v.file,
  }));
}

/** One queue (tutors or students) filtered to a status. Rows are flattened per page. */
export function useAdminVerifications(
  kind: VerificationKind,
  status: VerificationStatus,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.verifications(kind, { status }),
    queryFn: async ({ pageParam }): Promise<VerificationPage> => {
      if (kind === "tutors") {
        const page = await adminVerificationApi.listTutors(status, pageParam);
        return { rows: tutorRows(page), nextCursor: page.nextCursor };
      }
      const page = await adminVerificationApi.listStudents(status, pageParam);
      return { rows: studentRows(page), nextCursor: page.nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/**
 * An approve or reject. Every verification list refreshes on settle, so a 409 (someone else
 * already decided it) also shows the current state.
 */
export function useDecideVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      kind,
      id,
      body,
    }: {
      kind: VerificationKind;
      id: string;
      body: DecideVerificationInput;
    }): Promise<void> => {
      if (kind === "tutors") {
        await adminVerificationApi.decideTutor(id, body);
      } else {
        await adminVerificationApi.decideStudent(id, body);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.verificationsAll,
      }),
  });
}

const NOTE_MIN = 3;
const NOTE_MAX = 500;

/** The note a user reads when their ID or video is rejected. Required, 3 to 500 characters. */
export function validateDecisionNote(text: string): string | undefined {
  const note = text.trim();
  if (note === "") return "Write a note explaining the decision.";
  if (note.length < NOTE_MIN) return "Write at least 3 characters.";
  if (note.length > NOTE_MAX) return "Keep it under 500 characters.";
  return undefined;
}

type Tone = "neutral" | "warning" | "success" | "error";

export const VERIFICATION_STATUS_META: Record<
  VerificationRecordStatus,
  { label: string; tone: Tone }
> = {
  NOT_SUBMITTED: { label: "Not submitted", tone: "neutral" },
  PENDING: { label: "Waiting for review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "error" },
};

/** The tutor's own verification state, as shown next to their name on videos and packages. */
export const TUTOR_VERIFICATION_LABEL: Record<
  VerificationRecordStatus,
  string
> = {
  NOT_SUBMITTED: "Verification not submitted",
  PENDING: "Verification pending",
  APPROVED: "Verified",
  REJECTED: "Verification rejected",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

/** "PDF", "JPEG" and so on; unknown types show their MIME name. */
export function fileTypeText(contentType: string): string {
  return FILE_TYPE_LABELS[contentType] ?? contentType;
}
