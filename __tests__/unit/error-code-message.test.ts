import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/profile";
import { ERROR_CODES, errorCodeMessage, isRateLimit } from "@/lib/api-errors";

describe("errorCodeMessage", () => {
  it.each(Object.values(ERROR_CODES))("%s has a non-empty message", (code) => {
    const msg = errorCodeMessage(
      new ApiError("m", 400, {
        code,
        details: { packageIds: [1, 2], requirementIds: [1, 2] },
      }),
    );
    expect(typeof msg).toBe("string");
    expect(msg).not.toBe("");
  });

  describe("REQUIREMENT_IN_USE", () => {
    const code = ERROR_CODES.RequirementInUse;

    it("names a single open package", () => {
      expect(
        errorCodeMessage(
          new ApiError("m", 409, { code, details: { packageIds: [7] } }),
        ),
      ).toBe(
        "This set is used by 1 open package. Move it to another set first.",
      );
    });

    it("counts several open packages", () => {
      expect(
        errorCodeMessage(
          new ApiError("m", 409, { code, details: { packageIds: [1, 2, 3] } }),
        ),
      ).toBe(
        "This set is used by 3 open packages. Move them to another set first.",
      );
    });

    it("falls back when packageIds is missing", () => {
      expect(errorCodeMessage(new ApiError("m", 409, { code }))).toBe(
        "This set is used by open packages. Move them to another set first.",
      );
    });
  });

  describe("REQUIREMENT_LOSES_LAST_SUBJECT", () => {
    const code = ERROR_CODES.RequirementLosesLastSubject;

    it("names a single requirement set", () => {
      expect(
        errorCodeMessage(
          new ApiError("m", 409, {
            code,
            details: { requirementIds: [4] },
          }),
        ),
      ).toBe(
        "Removing this subject would leave 1 requirement set with no subjects.",
      );
    });

    it("counts several requirement sets", () => {
      expect(
        errorCodeMessage(
          new ApiError("m", 409, {
            code,
            details: { requirementIds: [4, 5] },
          }),
        ),
      ).toBe(
        "Removing this subject would leave 2 requirement sets with no subjects.",
      );
    });

    it("falls back when requirementIds is missing", () => {
      expect(errorCodeMessage(new ApiError("m", 409, { code }))).toBe(
        "Removing this subject would leave a requirement set with no subjects.",
      );
    });
  });

  it("returns undefined for an unknown code", () => {
    expect(
      errorCodeMessage(new ApiError("m", 400, { code: "SOMETHING_NEW" })),
    ).toBeUndefined();
  });

  it("returns undefined for an ApiError without a code", () => {
    expect(errorCodeMessage(new ApiError("m", 500))).toBeUndefined();
  });

  it("returns undefined for a plain Error or a string", () => {
    expect(errorCodeMessage(new Error("boom"))).toBeUndefined();
    expect(errorCodeMessage("x")).toBeUndefined();
  });
});

describe("isRateLimit", () => {
  it("is true for a 429 without a code", () => {
    expect(isRateLimit(new ApiError("m", 429))).toBe(true);
  });

  it("is false for a 409", () => {
    expect(isRateLimit(new ApiError("m", 409))).toBe(false);
  });

  it("is false for a plain Error", () => {
    expect(isRateLimit(new Error("m"))).toBe(false);
  });
});
