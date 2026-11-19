import { describe, expect, it } from "vitest";
import { previewKind } from "@/lib/files";

describe("previewKind", () => {
  it("renders images, PDFs and videos inline", () => {
    expect(previewKind("image/jpeg")).toBe("image");
    expect(previewKind("image/webp")).toBe("image");
    expect(previewKind("application/pdf")).toBe("pdf");
    expect(previewKind("video/quicktime")).toBe("video");
  });

  it("gives nothing for other types", () => {
    expect(previewKind("application/zip")).toBe("none");
    expect(previewKind("")).toBe("none");
  });
});
