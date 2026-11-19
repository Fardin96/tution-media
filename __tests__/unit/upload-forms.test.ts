import { describe, expect, it } from "vitest";
import {
  credentialLimitReached,
  MAX_TUTOR_CREDENTIALS,
  MAX_TUTOR_VIDEOS,
  validateCredentialForm,
  validateVideoForm,
  videoLimitReached,
} from "@/lib/upload-forms";

const ok = { examLabel: "SSC 2024", result: "GPA 5.00", fileId: "file-1" };

describe("validateCredentialForm", () => {
  it("accepts a complete form", () => {
    expect(validateCredentialForm(ok)).toEqual({});
  });

  it("requires an exam label, a result and a file", () => {
    expect(
      validateCredentialForm({ examLabel: "  ", result: "", fileId: null }),
    ).toEqual({
      examLabel: "Enter the exam, like SSC 2024.",
      result: "Enter the result, like GPA 5.00.",
      fileId: "Upload the result sheet.",
    });
  });

  it("treats whitespace-only text as empty", () => {
    expect(validateCredentialForm({ ...ok, result: "   " }).result).toBe(
      "Enter the result, like GPA 5.00.",
    );
  });

  it("allows exactly 80 characters for the exam label and 40 for the result", () => {
    expect(
      validateCredentialForm({
        ...ok,
        examLabel: "a".repeat(80),
        result: "b".repeat(40),
      }),
    ).toEqual({});
  });

  it("refuses 81 characters for the exam label and 41 for the result", () => {
    const errors = validateCredentialForm({
      ...ok,
      examLabel: "a".repeat(81),
      result: "b".repeat(41),
    });
    expect(errors.examLabel).toBe("Keep it to 80 characters or fewer.");
    expect(errors.result).toBe("Keep it to 40 characters or fewer.");
  });

  it("measures length after trimming", () => {
    expect(
      validateCredentialForm({ ...ok, examLabel: `  ${"a".repeat(80)}  ` }),
    ).toEqual({});
  });
});

describe("validateVideoForm", () => {
  it("accepts a title and a file", () => {
    expect(validateVideoForm({ title: "Demo lesson", fileId: "f" })).toEqual(
      {},
    );
  });

  it("requires a title and a file", () => {
    expect(validateVideoForm({ title: "", fileId: null })).toEqual({
      title: "Enter a title.",
      fileId: "Upload the video.",
    });
  });

  it("allows exactly 100 characters and refuses 101", () => {
    expect(validateVideoForm({ title: "t".repeat(100), fileId: "f" })).toEqual(
      {},
    );
    expect(
      validateVideoForm({ title: "t".repeat(101), fileId: "f" }).title,
    ).toBe("Keep it to 100 characters or fewer.");
  });
});

describe("limits", () => {
  it("matches the API limits", () => {
    expect(MAX_TUTOR_CREDENTIALS).toBe(20);
    expect(MAX_TUTOR_VIDEOS).toBe(3);
  });

  it("reports the credential limit at 20", () => {
    expect(credentialLimitReached(19)).toBe(false);
    expect(credentialLimitReached(20)).toBe(true);
  });

  it("reports the video limit at 3", () => {
    expect(videoLimitReached(2)).toBe(false);
    expect(videoLimitReached(3)).toBe(true);
  });
});
