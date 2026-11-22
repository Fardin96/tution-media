import { describe, it, expect, afterEach, vi } from "vitest";

const PREFIX_ENV = "NEXT_PUBLIC_MEDIA_URL_PREFIX";
const originalPrefix = process.env[PREFIX_ENV];
const PREFIX = "https://media.example.com/pub";

// MEDIA_URL_PREFIX is read at import time, so each case re-imports the module with its own env.
async function loadMedia(prefix: string | undefined) {
  vi.resetModules();
  if (prefix === undefined) delete process.env[PREFIX_ENV];
  else vi.stubEnv(PREFIX_ENV, prefix);
  return import("@/lib/media");
}

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalPrefix === undefined) delete process.env[PREFIX_ENV];
  else process.env[PREFIX_ENV] = originalPrefix;
});

describe("canOptimizeImage with a media prefix", () => {
  it("allows local files and public files in the media bucket", async () => {
    const { canOptimizeImage } = await loadMedia(PREFIX);
    expect(canOptimizeImage("/assets/x.png")).toBe(true);
    expect(canOptimizeImage(`${PREFIX}/a.webp`)).toBe(true);
  });

  it("refuses protocol-relative URLs", async () => {
    const { canOptimizeImage } = await loadMedia(PREFIX);
    expect(canOptimizeImage("//evil.com/x.png")).toBe(false);
  });

  it("refuses blob: previews", async () => {
    const { canOptimizeImage } = await loadMedia(PREFIX);
    expect(canOptimizeImage("blob:https://app.example.com/1234-abcd")).toBe(
      false,
    );
  });

  it("refuses signed links (X-Amz- query parameters) even on the bucket", async () => {
    const { canOptimizeImage } = await loadMedia(PREFIX);
    expect(
      canOptimizeImage(
        `${PREFIX}/a.webp?X-Amz-Signature=abc&X-Amz-Expires=3600`,
      ),
    ).toBe(false);
    expect(canOptimizeImage(`${PREFIX}/a.webp?v=1&X-Amz-Signature=abc`)).toBe(
      false,
    );
  });

  it("refuses a path that only shares the prefix's start", async () => {
    const { canOptimizeImage } = await loadMedia(PREFIX);
    expect(canOptimizeImage("https://media.example.com/public/a.webp")).toBe(
      false,
    );
    expect(canOptimizeImage("https://media.example.com/pubx/a.webp")).toBe(
      false,
    );
  });

  it("refuses other hosts, including ones that end with the bucket host", async () => {
    const { canOptimizeImage } = await loadMedia(PREFIX);
    expect(canOptimizeImage("https://other.example.com/pub/a.webp")).toBe(
      false,
    );
    expect(
      canOptimizeImage("https://media.example.com.evil.com/pub/a.webp"),
    ).toBe(false);
  });

  it("ignores trailing slashes on the prefix env", async () => {
    const { MEDIA_URL_PREFIX, canOptimizeImage } = await loadMedia(
      `${PREFIX}//`,
    );
    expect(MEDIA_URL_PREFIX).toBe(PREFIX);
    expect(canOptimizeImage(`${PREFIX}/a.webp`)).toBe(true);
    expect(canOptimizeImage(`${PREFIX}/a.webp?X-Amz-Signature=x`)).toBe(false);
  });
});

describe("canOptimizeImage without a media prefix", () => {
  it("treats every remote URL as unoptimizable when the env is unset", async () => {
    const { MEDIA_URL_PREFIX, canOptimizeImage } = await loadMedia(undefined);
    expect(MEDIA_URL_PREFIX).toBe("");
    expect(canOptimizeImage(`${PREFIX}/a.webp`)).toBe(false);
    expect(canOptimizeImage("https://media.example.com/a.webp")).toBe(false);
  });

  it("treats an empty prefix the same as unset", async () => {
    const { canOptimizeImage } = await loadMedia("");
    expect(canOptimizeImage(`${PREFIX}/a.webp`)).toBe(false);
  });

  it("still allows local files and refuses protocol-relative URLs", async () => {
    const { canOptimizeImage } = await loadMedia(undefined);
    expect(canOptimizeImage("/assets/x.png")).toBe(true);
    expect(canOptimizeImage("//evil.com/x.png")).toBe(false);
    expect(canOptimizeImage("blob:https://app.example.com/1")).toBe(false);
  });
});
