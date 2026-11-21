import { describe, it, expect } from "vitest";
import {
  blockScopeText,
  eventTitle,
  purposeText,
  validateBlockScope,
} from "@/lib/admin-uploads";

describe("blockScopeText", () => {
  it("names the paused scope", () => {
    expect(blockScopeText({ blocksVideos: true, blocksDocuments: false })).toBe(
      "Videos",
    );
    expect(blockScopeText({ blocksVideos: false, blocksDocuments: true })).toBe(
      "IDs and certificates",
    );
    expect(blockScopeText({ blocksVideos: true, blocksDocuments: true })).toBe(
      "Videos, IDs and certificates",
    );
  });

  it("returns null when nothing is paused", () => {
    expect(
      blockScopeText({ blocksVideos: false, blocksDocuments: false }),
    ).toBeNull();
  });
});

describe("validateBlockScope", () => {
  it("asks for at least one scope", () => {
    expect(validateBlockScope(false, false)).toBe(
      "Pick videos, documents or both.",
    );
  });

  it("accepts videos, documents or both", () => {
    expect(validateBlockScope(true, false)).toBeUndefined();
    expect(validateBlockScope(false, true)).toBeUndefined();
    expect(validateBlockScope(true, true)).toBeUndefined();
  });
});

describe("eventTitle", () => {
  it("labels every upload action", () => {
    expect(eventTitle({ action: "APPROVED" })).toBe("Approved");
    expect(eventTitle({ action: "REJECTED" })).toBe("Rejected");
    expect(eventTitle({ action: "REVOKED" })).toBe("Approval revoked");
    expect(eventTitle({ action: "REMOVED" })).toBe("File removed");
    expect(eventTitle({ action: "BLOCKED" })).toBe("Uploads paused");
    expect(eventTitle({ action: "UNBLOCKED" })).toBe("Uploads resumed");
  });
});

describe("purposeText", () => {
  it("labels each file purpose", () => {
    expect(purposeText("STUDENT_ID")).toBe("Student ID");
    expect(purposeText("TUTOR_ID")).toBe("Tutor ID");
    expect(purposeText("CREDENTIAL")).toBe("Certificate");
    expect(purposeText("TUTOR_VIDEO")).toBe("Video");
    expect(purposeText("BLOG_COVER")).toBe("Blog cover");
    expect(purposeText("SITE_IMAGE")).toBe("Site image");
    expect(purposeText("SITE_VIDEO")).toBe("Site video");
  });

  it("returns null without a purpose", () => {
    expect(purposeText(null)).toBeNull();
  });
});
