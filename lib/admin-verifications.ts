import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getStoredTokens } from "./api";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import type { UploadFlags } from "./admin-moderation";
import { refreshTutorProfilesAsAdmin } from "./tutor-profile.actions";

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
  /** False when the note is for admins only. */
  noteVisible: boolean;
  /** Only the tutor's newest submission can be decided or removed. Students are always latest. */
  isLatest: boolean;
  /** The account that uploaded the file. Links to its upload history. */
  accountId: string;
  uploadFlags: UploadFlags;
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
    noteVisible: v.noteVisible,
    isLatest: v.isLatest,
    accountId: v.tutor.accountId,
    uploadFlags: v.uploadFlags,
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
    noteVisible: v.noteVisible,
    isLatest: true,
    accountId: v.student.accountId,
    uploadFlags: v.uploadFlags,
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
    // A tutor's verified badge shows on the public profile; a student's ID does not.
    onSuccess: (_data, variables) => {
      if (variables.kind === "tutors") void refreshPublicTutors();
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.verificationsAll,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.uploadsAll,
        }),
      ]),
  });
}

export type VerificationActions = {
  approve: boolean;
  /** Reject a pending ID. */
  reject: boolean;
  /** Reject an approved ID, which takes away the verified status. */
  revoke: boolean;
  removeFile: boolean;
};

/**
 * Which decision buttons a row offers. Only the latest submission can change, and a removed file
 * (DELETED) can't be approved or removed again.
 */
export function verificationActions(row: VerificationRow): VerificationActions {
  const none: VerificationActions = {
    approve: false,
    reject: false,
    revoke: false,
    removeFile: false,
  };
  if (!row.isLatest) return none;
  const fileLive = row.file !== null && row.file.status !== "DELETED";
  switch (row.status) {
    case "PENDING":
      return { ...none, approve: fileLive, reject: true };
    case "APPROVED":
      return { ...none, revoke: true, removeFile: fileLive };
    case "REJECTED":
      return { ...none, approve: fileLive, removeFile: fileLive };
    default:
      return none;
  }
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
