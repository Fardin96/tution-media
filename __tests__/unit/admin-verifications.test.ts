import { describe, it, expect } from "vitest";
import {
  fileTypeText,
  verificationActions,
  VERIFICATION_STATUS_META,
  type VerificationRow,
} from "@/lib/admin-verifications";
import { validateSortOrder, VIDEO_STATUS_META } from "@/lib/admin-videos";
import { actionLabel } from "@/lib/admin-audit";

function row(overrides: Partial<VerificationRow> = {}): VerificationRow {
  return {
    kind: "tutors",
    decideId: "v1",
    name: "Rahim",
    institute: null,
    studentIdNumber: "123",
    submittedAt: "2026-11-01T00:00:00.000Z",
    status: "PENDING",
    note: null,
    noteVisible: true,
    isLatest: true,
    accountId: "acc-1",
    uploadFlags: { recentIssues: 0, uploadsBlocked: false },
    file: {
      id: "f1",
      purpose: "TUTOR_ID",
      contentType: "application/pdf",
      sizeBytes: 100,
      status: "UPLOADED",
      fileName: "id.pdf",
      createdAt: "2026-11-01T00:00:00.000Z",
      uploadedAt: "2026-11-01T00:00:00.000Z",
      ownerAccountId: "acc-1",
      ownerEmail: "rahim@example.com",
      published: false,
      inUse: true,
    } as VerificationRow["file"],
    ...overrides,
  };
}

describe("verificationActions", () => {
  it("offers reject and approve for a pending ID", () => {
    expect(verificationActions(row())).toEqual({
      approve: true,
      reject: true,
      revoke: false,
      removeFile: false,
    });
  });

  it("offers revoke and remove for an approved ID", () => {
    expect(verificationActions(row({ status: "APPROVED" }))).toEqual({
      approve: false,
      reject: false,
      revoke: true,
      removeFile: true,
    });
  });

  it("offers approve and remove for a rejected ID", () => {
    expect(verificationActions(row({ status: "REJECTED" }))).toEqual({
      approve: true,
      reject: false,
      revoke: false,
      removeFile: true,
    });
  });

  it("offers no decisions for a submission a newer one replaced", () => {
    const actions = verificationActions(row({ isLatest: false }));
    expect(Object.values(actions).some(Boolean)).toBe(false);
  });

  it("never offers approve or remove for a removed file", () => {
    const deleted = { ...row().file!, status: "DELETED" as const };
    expect(
      verificationActions(row({ status: "REJECTED", file: deleted })),
    ).toEqual({
      approve: false,
      reject: false,
      revoke: false,
      removeFile: false,
    });
    expect(
      verificationActions(row({ status: "APPROVED", file: deleted })),
    ).toEqual({
      approve: false,
      reject: false,
      revoke: true,
      removeFile: false,
    });
    expect(verificationActions(row({ file: deleted })).approve).toBe(false);
  });

  it("does not approve a pending ID that has no file", () => {
    expect(verificationActions(row({ file: null })).approve).toBe(false);
  });
});

describe("VERIFICATION_STATUS_META", () => {
  it("labels and tones each status for the pill", () => {
    expect(VERIFICATION_STATUS_META.PENDING).toEqual({
      label: "Waiting for review",
      tone: "warning",
    });
    expect(VERIFICATION_STATUS_META.APPROVED).toEqual({
      label: "Approved",
      tone: "success",
    });
    expect(VERIFICATION_STATUS_META.REJECTED).toEqual({
      label: "Rejected",
      tone: "error",
    });
    expect(VERIFICATION_STATUS_META.NOT_SUBMITTED).toEqual({
      label: "Not submitted",
      tone: "neutral",
    });
  });
});

describe("VIDEO_STATUS_META", () => {
  it("labels and tones each video status", () => {
    expect(VIDEO_STATUS_META.PENDING).toEqual({
      label: "Waiting for review",
      tone: "warning",
    });
    expect(VIDEO_STATUS_META.APPROVED).toEqual({
      label: "Approved",
      tone: "success",
    });
    expect(VIDEO_STATUS_META.REJECTED).toEqual({
      label: "Rejected",
      tone: "error",
    });
  });
});

describe("validateSortOrder", () => {
  it("accepts whole numbers from 0 to 10000", () => {
    expect(validateSortOrder("0")).toBeUndefined();
    expect(validateSortOrder(" 10000 ")).toBeUndefined();
  });

  it("rejects values outside the range or not whole", () => {
    for (const bad of ["", "-1", "10001", "1.5", "abc"]) {
      expect(validateSortOrder(bad)).toBe(
        "Enter a whole number from 0 to 10000.",
      );
    }
  });
});

describe("fileTypeText", () => {
  it("names the common upload types", () => {
    expect(fileTypeText("application/pdf")).toBe("PDF");
    expect(fileTypeText("image/jpeg")).toBe("JPEG");
    expect(fileTypeText("image/webp")).toBe("WebP");
  });

  it("falls back to the MIME type", () => {
    expect(fileTypeText("image/gif")).toBe("image/gif");
  });
});

describe("audit labels for the uploads actions", () => {
  it("reads each new action in plain words", () => {
    expect(actionLabel("verification.decide")).toBe(
      "Decided an ID verification",
    );
    expect(actionLabel("video.moderate")).toBe("Decided a tutor video");
    expect(actionLabel("file.view")).toBe("Opened a private file");
    expect(actionLabel("blog.delete")).toBe("Deleted a blog post");
  });
});
