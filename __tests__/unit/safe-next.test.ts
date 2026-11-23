import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it.each([
    "/tutors/abc",
    "/tutors/abc?sort=emerging",
    "/dashboard/find-tuitions?scope=invited#top",
    "/#faq",
  ])("keeps a local path: %s", (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["absolute url", "https://evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["raw CR and LF", "/tutors\r\nSet-Cookie: x=1"],
    ["raw tab", "/tutors\tx"],
    ["DEL character", "/tutors\u007f"],
    ["backslash in the query", "/tutors?x=\\"],
    ["too long", `/${"a".repeat(500)}`],
    ["empty string", ""],
    ["no leading slash", "tutors/abc"],
  ])("rejects %s", (_, raw) => {
    expect(safeNext(raw)).toBeNull();
  });

  it("rejects arrays", () => {
    expect(safeNext(["/tutors/abc"])).toBeNull();
    expect(safeNext(["/tutors/abc", "/dashboard"])).toBeNull();
  });

  it("rejects missing values", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(null)).toBeNull();
  });

  it.each([
    "/sign-in",
    "/sign-in?next=/tutors/abc",
    "/sign-up",
    "/sign-up?x=1",
    "/api/v1/me",
    "/api",
  ])("rejects a loop or API path: %s", (raw) => {
    expect(safeNext(raw)).toBeNull();
  });

  it("keeps an encoded CRLF as plain text, since it is not a raw control character", () => {
    expect(safeNext("/%0d%0a")).toBe("/%0d%0a");
  });

  it("keeps a path that merely shares letters with an API prefix", () => {
    expect(safeNext("/apiary")).toBe("/apiary");
  });
});
