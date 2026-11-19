import { describe, it, expect } from "vitest";
import {
  REVIEW_DIRECTION_LABEL,
  REVIEW_NOTE_MAX,
  reviewParties,
  validateReviewNote,
  type AdminReview,
} from "@/lib/admin-reviews";

function review(overrides: Partial<AdminReview> = {}): AdminReview {
  return {
    id: "r1",
    direction: "STUDENT_TO_TUTOR",
    rating: 4,
    comment: "Clear and on time.",
    status: "VISIBLE",
    createdAt: "2026-11-14T08:00:00.000Z",
    updatedAt: "2026-11-14T08:00:00.000Z",
    tutor: { id: "t1", accountId: "a-t", name: "Nusrat Jahan" },
    student: { id: "s1", accountId: "a-s", name: "Rafi Hasan" },
    ...overrides,
  };
}

describe("validateReviewNote", () => {
  it("asks for at least 3 characters after trimming", () => {
    expect(validateReviewNote("")).toBe("Write at least 3 characters.");
    expect(validateReviewNote("  ab  ")).toBe("Write at least 3 characters.");
    expect(validateReviewNote("abc")).toBeUndefined();
  });

  it("caps the note at 500 characters", () => {
    expect(validateReviewNote("a".repeat(REVIEW_NOTE_MAX))).toBeUndefined();
    expect(validateReviewNote("a".repeat(REVIEW_NOTE_MAX + 1))).toBe(
      "Keep it to 500 characters or fewer.",
    );
  });
});

describe("reviewParties", () => {
  it("makes the student the author of a student-to-tutor review", () => {
    expect(reviewParties(review())).toEqual({
      author: "Rafi Hasan",
      subject: "Nusrat Jahan",
    });
  });

  it("makes the tutor the author of a tutor-to-student review", () => {
    expect(reviewParties(review({ direction: "TUTOR_TO_STUDENT" }))).toEqual({
      author: "Nusrat Jahan",
      subject: "Rafi Hasan",
    });
  });
});

describe("REVIEW_DIRECTION_LABEL", () => {
  it("names both directions", () => {
    expect(REVIEW_DIRECTION_LABEL.STUDENT_TO_TUTOR).toBe(
      "Student reviewed tutor",
    );
    expect(REVIEW_DIRECTION_LABEL.TUTOR_TO_STUDENT).toBe(
      "Tutor reviewed student",
    );
  });
});
