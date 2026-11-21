import { describe, it, expect } from "vitest";
import { actionLabel } from "@/lib/admin-audit";
import {
  CASE_NOTE_MAX,
  ageText,
  isCaseOpen,
  partyName,
  validateCaseNote,
  type AdminParty,
} from "@/lib/admin-cases";

const NOW = new Date("2026-11-18T12:00:00.000Z").getTime();

describe("ageText", () => {
  it("counts days, hours and minutes, rounding down", () => {
    expect(ageText("2026-11-15T11:00:00.000Z", NOW)).toBe("3 days ago");
    expect(ageText("2026-11-17T12:00:00.000Z", NOW)).toBe("1 day ago");
    expect(ageText("2026-11-18T07:30:00.000Z", NOW)).toBe("4 hours ago");
    expect(ageText("2026-11-18T11:15:00.000Z", NOW)).toBe("45 minutes ago");
  });

  it("says just now under a minute and for future dates", () => {
    expect(ageText("2026-11-18T11:59:30.000Z", NOW)).toBe("just now");
    expect(ageText("2026-11-19T12:00:00.000Z", NOW)).toBe("just now");
  });

  it("returns nothing for a bad date", () => {
    expect(ageText("nope", NOW)).toBe("");
  });
});

describe("validateCaseNote", () => {
  it("asks for at least 3 characters after trimming", () => {
    expect(validateCaseNote(" a ")).toBe("Write at least 3 characters.");
    expect(validateCaseNote("Done")).toBeUndefined();
  });

  it("caps the note at 500 characters", () => {
    expect(validateCaseNote("a".repeat(CASE_NOTE_MAX))).toBeUndefined();
    expect(validateCaseNote("a".repeat(CASE_NOTE_MAX + 1))).toBe(
      "Keep it to 500 characters or fewer.",
    );
  });
});

describe("isCaseOpen", () => {
  it("is true for OPEN and UNDER_REVIEW only", () => {
    expect(isCaseOpen("OPEN")).toBe(true);
    expect(isCaseOpen("UNDER_REVIEW")).toBe(true);
    expect(isCaseOpen("RESOLVED")).toBe(false);
    expect(isCaseOpen("DISMISSED")).toBe(false);
  });
});

describe("partyName", () => {
  const party: AdminParty = {
    accountId: "a1",
    role: "STUDENT",
    status: "ACTIVE",
    name: "Rafi Hasan",
    email: "rafi@example.com",
  };
  it("falls back to the email when there is no name", () => {
    expect(partyName(party)).toBe("Rafi Hasan");
    expect(partyName({ ...party, name: null })).toBe("rafi@example.com");
    expect(partyName({ ...party, name: "  " })).toBe("rafi@example.com");
  });
});

describe("audit labels", () => {
  it("covers the review, report and dispute actions", () => {
    for (const action of [
      "review.moderate",
      "report.assign",
      "report.resolve",
      "report.dismiss",
      "dispute.assign",
      "dispute.resolve",
      "dispute.dismiss",
    ]) {
      expect(actionLabel(action)).not.toBe(action);
    }
  });

  it("reads the matching and city actions in plain words", () => {
    expect(actionLabel("matching.update")).toBe("Matching rules updated");
    expect(actionLabel("city.upsert")).toBe("City boundary saved");
    expect(actionLabel("city.update")).toBe("City updated");
  });
});
