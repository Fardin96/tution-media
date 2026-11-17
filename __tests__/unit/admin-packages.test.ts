import { describe, it, expect } from "vitest";
import { validateRejectNote } from "@/lib/admin-packages";
import { packageState } from "@/lib/packages";

describe("validateRejectNote", () => {
  it("asks for a note when it is empty", () => {
    expect(validateRejectNote("")).toBe("Tell the tutor what to change.");
  });

  it("treats a whitespace-only note as empty", () => {
    expect(validateRejectNote("   \n  ")).toBe(
      "Tell the tutor what to change.",
    );
  });

  it("accepts a note of exactly 500 characters", () => {
    expect(validateRejectNote("a".repeat(500))).toBeUndefined();
  });

  it("rejects a note over 500 characters", () => {
    expect(validateRejectNote("a".repeat(501))).toBe(
      "Keep it under 500 characters.",
    );
  });

  it("does not count surrounding spaces toward the limit", () => {
    expect(validateRejectNote(`  ${"a".repeat(500)}  `)).toBeUndefined();
  });

  it("accepts a short note", () => {
    expect(validateRejectNote("Add the class range.")).toBeUndefined();
  });
});

describe("packageState", () => {
  const base = {
    closed: false,
    status: "OPEN",
    moderationStatus: "APPROVED",
  } as const;

  it("shows an open approved package as live", () => {
    expect(packageState({ ...base })).toEqual({ label: "Live", tone: "info" });
  });

  it("shows an open package waiting for review as in review", () => {
    expect(packageState({ ...base, moderationStatus: "PENDING" })).toEqual({
      label: "In review",
      tone: "info",
    });
  });

  it("shows an open rejected package as changes needed", () => {
    expect(packageState({ ...base, moderationStatus: "REJECTED" })).toEqual({
      label: "Changes needed",
      tone: "error",
    });
  });

  it("keeps closed packages as closed whatever their moderation", () => {
    expect(
      packageState({
        closed: false,
        status: "CLOSED",
        moderationStatus: "PENDING",
      }),
    ).toEqual({ label: "Closed", tone: "neutral" });
    expect(
      packageState({
        closed: false,
        status: "CLOSED",
        moderationStatus: "APPROVED",
      }),
    ).toEqual({ label: "Closed", tone: "neutral" });
  });

  it("keeps a package with a confirmed request as taken", () => {
    expect(
      packageState({
        closed: true,
        status: "OPEN",
        moderationStatus: "APPROVED",
      }),
    ).toEqual({ label: "Taken", tone: "success" });
  });
});
