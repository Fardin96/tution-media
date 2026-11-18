import { describe, it, expect } from "vitest";
import {
  fileTypeText,
  validateDecisionNote,
  VERIFICATION_STATUS_META,
} from "@/lib/admin-verifications";
import { validateSortOrder, VIDEO_STATUS_META } from "@/lib/admin-videos";
import { actionLabel } from "@/lib/admin-audit";

describe("validateDecisionNote", () => {
  it("asks for a note when it is empty", () => {
    expect(validateDecisionNote("")).toBe(
      "Write a note explaining the decision.",
    );
  });

  it("treats a whitespace-only note as empty", () => {
    expect(validateDecisionNote("   \n  ")).toBe(
      "Write a note explaining the decision.",
    );
  });

  it("rejects a note shorter than 3 characters after trimming", () => {
    expect(validateDecisionNote("  ab  ")).toBe("Write at least 3 characters.");
  });

  it("accepts a note of exactly 3 characters", () => {
    expect(validateDecisionNote("abc")).toBeUndefined();
  });

  it("accepts a note of exactly 500 characters", () => {
    expect(validateDecisionNote("a".repeat(500))).toBeUndefined();
  });

  it("rejects a note over 500 characters", () => {
    expect(validateDecisionNote("a".repeat(501))).toBe(
      "Keep it under 500 characters.",
    );
  });

  it("does not count surrounding spaces toward the limit", () => {
    expect(validateDecisionNote(`  ${"a".repeat(500)}  `)).toBeUndefined();
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
