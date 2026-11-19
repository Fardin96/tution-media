import { describe, it, expect } from "vitest";
import { REVIEW_COMMENT_MAX, ratingText, validateReview } from "@/lib/reviews";

describe("validateReview", () => {
  it("accepts a rating with no comment", () => {
    expect(validateReview({ rating: 4, comment: "" })).toEqual({});
  });

  it("requires a rating from 1 to 5", () => {
    for (const rating of [0, 6, 2.5, -1]) {
      expect(validateReview({ rating, comment: "" }).rating).toBe(
        "Pick a rating from 1 to 5 stars.",
      );
    }
    expect(validateReview({ rating: 1, comment: "" }).rating).toBeUndefined();
    expect(validateReview({ rating: 5, comment: "" }).rating).toBeUndefined();
  });

  it("allows a comment up to the limit and refuses one past it", () => {
    expect(
      validateReview({ rating: 5, comment: "a".repeat(REVIEW_COMMENT_MAX) }),
    ).toEqual({});
    expect(
      validateReview({ rating: 5, comment: "a".repeat(REVIEW_COMMENT_MAX + 1) })
        .comment,
    ).toBe("Keep your comment under 1000 characters.");
  });

  it("does not count surrounding spaces against the limit", () => {
    expect(
      validateReview({
        rating: 5,
        comment: `  ${"a".repeat(REVIEW_COMMENT_MAX)}  `,
      }),
    ).toEqual({});
  });
});

describe("ratingText", () => {
  it("says New when nobody has rated", () => {
    expect(ratingText(0, 0)).toBe("New");
  });

  it("shows one decimal and the count", () => {
    expect(ratingText(4.5, 12)).toBe("4.5 (12 reviews)");
    expect(ratingText(5, 1)).toBe("5.0 (1 review)");
  });
});
