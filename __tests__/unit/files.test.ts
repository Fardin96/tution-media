import { describe, expect, it } from "vitest";
import {
  acceptFor,
  checkFile,
  fileContentType,
  signedUrlExpired,
} from "@/lib/files";

const MB = 1024 * 1024;

describe("fileContentType", () => {
  it("keeps a reported type", () => {
    expect(fileContentType({ name: "id.png", type: "image/png" })).toBe(
      "image/png",
    );
  });

  it("maps non-standard aliases", () => {
    expect(fileContentType({ name: "id", type: "image/jpg" })).toBe(
      "image/jpeg",
    );
    expect(fileContentType({ name: "clip", type: "video/x-m4v" })).toBe(
      "video/mp4",
    );
  });

  it("falls back to the extension when the type is missing or generic", () => {
    expect(fileContentType({ name: "Scan.PDF", type: "" })).toBe(
      "application/pdf",
    );
    expect(
      fileContentType({ name: "clip.mov", type: "application/octet-stream" }),
    ).toBe("video/quicktime");
    expect(fileContentType({ name: "notes", type: "" })).toBe("");
  });
});

describe("checkFile", () => {
  it("accepts a file the browser reported without a type", () => {
    expect(
      checkFile("CREDENTIAL", { name: "cert.pdf", type: "", size: 1000 }),
    ).toBeNull();
  });

  it("refuses wrong types, empty files and files over the limit", () => {
    expect(
      checkFile("CREDENTIAL", { name: "a.heic", type: "image/heic", size: 10 }),
    ).toMatch(/^Use /);
    expect(
      checkFile("CREDENTIAL", {
        name: "a.pdf",
        type: "application/pdf",
        size: 0,
      }),
    ).toBe("That file is empty.");
    expect(
      checkFile("TUTOR_VIDEO", {
        name: "a.mp4",
        type: "video/mp4",
        size: 2 * MB + 1,
      }),
    ).toMatch(/limit is 2\.0 MB/);
  });
});

describe("acceptFor", () => {
  it("lists types and their extensions", () => {
    expect(acceptFor("BLOG_COVER").split(",")).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ]);
  });
});

describe("signedUrlExpired", () => {
  const url = (date: string, expires: number) =>
    `https://acct.r2.cloudflarestorage.com/b/k.pdf?X-Amz-Date=${date}&X-Amz-Expires=${expires}&X-Amz-Signature=x`;
  const signedAt = Date.UTC(2026, 10, 19, 12, 0, 0);

  it("is false while the link is valid and true once it lapses", () => {
    const link = url("20261119T120000Z", 3600);
    expect(signedUrlExpired(link, signedAt + 10 * 60_000)).toBe(false);
    expect(signedUrlExpired(link, signedAt + 3600_000)).toBe(true);
    // Within the 30 s margin counts as expired.
    expect(signedUrlExpired(link, signedAt + 3600_000 - 10_000)).toBe(true);
  });

  it("never expires public or unparsable URLs", () => {
    expect(signedUrlExpired("https://media.example.com/k.png")).toBe(false);
    expect(signedUrlExpired("not a url")).toBe(false);
  });
});
