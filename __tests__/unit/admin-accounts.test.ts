import { describe, it, expect } from "vitest";
import { validateBlockReason } from "@/lib/admin-accounts";

describe("validateBlockReason", () => {
  it("asks for at least 3 characters", () => {
    expect(validateBlockReason("")).toBe("Write at least 3 characters.");
    expect(validateBlockReason("ab")).toBe("Write at least 3 characters.");
  });

  it("counts characters after trimming spaces", () => {
    expect(validateBlockReason("   ab   ")).toBe(
      "Write at least 3 characters.",
    );
    expect(validateBlockReason("  abc  ")).toBeUndefined();
  });

  it("accepts exactly 3 characters", () => {
    expect(validateBlockReason("abc")).toBeUndefined();
  });

  it("accepts up to 500 characters and rejects 501", () => {
    expect(validateBlockReason("a".repeat(500))).toBeUndefined();
    expect(validateBlockReason("a".repeat(501))).toBe(
      "Keep it under 500 characters.",
    );
  });
});
