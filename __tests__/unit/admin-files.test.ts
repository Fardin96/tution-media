import { describe, expect, it } from "vitest";
import {
  canRemoveFile,
  PURPOSE_LABEL,
  removeFileText,
  showUnverifyOption,
  summarizeStats,
  type AdminFile,
  type AdminFileStatsGroup,
} from "@/lib/admin-files";

function file(overrides: Partial<AdminFile> = {}): AdminFile {
  return {
    id: "f1",
    purpose: "TUTOR_ID",
    contentType: "application/pdf",
    sizeBytes: 10,
    status: "UPLOADED",
    fileName: "id.pdf",
    createdAt: "2026-11-01T00:00:00.000Z",
    uploadedAt: "2026-11-01T00:00:00.000Z",
    ownerAccountId: "acc-1",
    ownerEmail: "a@example.com",
    published: false,
    inUse: true,
    ...overrides,
  };
}

describe("canRemoveFile", () => {
  it("allows removing an uploaded file that a record uses", () => {
    expect(canRemoveFile(file())).toBe(true);
    expect(canRemoveFile(file({ purpose: "TUTOR_VIDEO" }))).toBe(true);
  });

  it("refuses unused, pending, deleted and blog cover files", () => {
    expect(canRemoveFile(file({ inUse: false }))).toBe(false);
    expect(canRemoveFile(file({ status: "PENDING_UPLOAD" }))).toBe(false);
    expect(canRemoveFile(file({ status: "DELETED" }))).toBe(false);
    expect(canRemoveFile(file({ purpose: "BLOG_COVER" }))).toBe(false);
  });
});

describe("showUnverifyOption", () => {
  it("offers the box only for an approved ID", () => {
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "TUTOR_ID",
        idStatus: "APPROVED",
      }),
    ).toBe(true);
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "STUDENT_ID",
        idStatus: "APPROVED",
      }),
    ).toBe(true);
  });

  it("hides the box for other statuses, unknown status and other files", () => {
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "TUTOR_ID",
        idStatus: "PENDING",
      }),
    ).toBe(false);
    expect(
      showUnverifyOption({ fileId: "f", fileName: null, purpose: "TUTOR_ID" }),
    ).toBe(false);
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "CREDENTIAL",
        idStatus: "APPROVED",
      }),
    ).toBe(false);
  });
});

describe("removeFileText", () => {
  it("says what happens for each purpose", () => {
    expect(
      removeFileText({ fileId: "f", fileName: null, purpose: "TUTOR_VIDEO" }),
    ).toBe("The video is deleted from their profile.");
    expect(
      removeFileText({ fileId: "f", fileName: null, purpose: "CREDENTIAL" }),
    ).toBe("The certificate is deleted from their profile.");
    expect(
      removeFileText({
        fileId: "f",
        fileName: null,
        purpose: "TUTOR_ID",
        idStatus: "PENDING",
      }),
    ).toBe("The ID is rejected and the user can upload a new one.");
  });

  it("explains an unknown ID status without promising a rejection", () => {
    const text = removeFileText({
      fileId: "f",
      fileName: null,
      purpose: "STUDENT_ID",
    });
    expect(text).toContain("A pending ID is rejected");
    expect(text).toContain("An approved ID stays verified");
  });
});

describe("PURPOSE_LABEL", () => {
  it("has a readable label for every purpose", () => {
    expect(PURPOSE_LABEL).toEqual({
      STUDENT_ID: "Student ID",
      TUTOR_ID: "Tutor ID",
      CREDENTIAL: "Credential",
      TUTOR_VIDEO: "Video",
      BLOG_COVER: "Blog cover",
    });
  });
});

describe("summarizeStats", () => {
  it("returns one row per purpose in order, with zeros when there are no groups", () => {
    const rows = summarizeStats([]);
    expect(rows.map((row) => row.purpose)).toEqual([
      "STUDENT_ID",
      "TUTOR_ID",
      "CREDENTIAL",
      "TUTOR_VIDEO",
      "BLOG_COVER",
    ]);
    expect(rows.every((row) => row.uploadedCount === 0)).toBe(true);
    expect(rows.every((row) => row.uploadedBytes === 0)).toBe(true);
  });

  it("counts and sizes only UPLOADED files, and counts pending and deleted apart", () => {
    const groups: AdminFileStatsGroup[] = [
      { purpose: "TUTOR_VIDEO", status: "UPLOADED", count: 3, totalBytes: 300 },
      {
        purpose: "TUTOR_VIDEO",
        status: "PENDING_UPLOAD",
        count: 2,
        totalBytes: 999,
      },
      { purpose: "TUTOR_VIDEO", status: "DELETED", count: 4, totalBytes: 500 },
      { purpose: "BLOG_COVER", status: "UPLOADED", count: 1, totalBytes: 50 },
    ];
    const video = summarizeStats(groups).find(
      (r) => r.purpose === "TUTOR_VIDEO",
    );
    expect(video).toEqual({
      purpose: "TUTOR_VIDEO",
      label: "Video",
      uploadedCount: 3,
      uploadedBytes: 300,
      pendingCount: 2,
      deletedCount: 4,
    });
    const cover = summarizeStats(groups).find(
      (r) => r.purpose === "BLOG_COVER",
    );
    expect(cover?.uploadedCount).toBe(1);
    expect(cover?.uploadedBytes).toBe(50);
    expect(cover?.pendingCount).toBe(0);
  });

  it("does not mix purposes", () => {
    const rows = summarizeStats([
      { purpose: "STUDENT_ID", status: "UPLOADED", count: 5, totalBytes: 10 },
    ]);
    expect(rows.find((r) => r.purpose === "TUTOR_ID")?.uploadedCount).toBe(0);
    expect(rows.find((r) => r.purpose === "STUDENT_ID")?.uploadedCount).toBe(5);
  });
});
