import { describe, expect, it } from "vitest";
import {
  PURPOSE_LABEL,
  summarizeStats,
  type AdminFileStatsGroup,
} from "@/lib/admin-files";

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
