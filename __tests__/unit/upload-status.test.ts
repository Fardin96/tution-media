import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  pausedText,
  uploadStatusApi,
  type UploadStatus,
} from "@/lib/upload-status";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const status = (over: Partial<UploadStatus> = {}): UploadStatus => ({
  blocksVideos: false,
  blocksDocuments: false,
  note: null,
  blockedAt: null,
  ...over,
});

describe("pausedText", () => {
  it("is null when nothing is paused or the status has not loaded", () => {
    expect(pausedText(undefined, "videos")).toBeNull();
    expect(pausedText(null, "documents")).toBeNull();
    expect(pausedText(status(), "videos")).toBeNull();
    expect(pausedText(status(), "documents")).toBeNull();
  });

  it("names video uploads when videos are paused", () => {
    const s = status({ blocksVideos: true });
    expect(pausedText(s, "videos")).toBe("An admin paused your video uploads.");
    expect(pausedText(s, "documents")).toBeNull();
  });

  it("names ID and certificate uploads when documents are paused", () => {
    const s = status({ blocksDocuments: true });
    expect(pausedText(s, "documents")).toBe(
      "An admin paused your ID and certificate uploads.",
    );
    expect(pausedText(s, "videos")).toBeNull();
  });

  it("reports both categories when both are paused", () => {
    const s = status({ blocksVideos: true, blocksDocuments: true });
    expect(pausedText(s, "videos")).toBe("An admin paused your video uploads.");
    expect(pausedText(s, "documents")).toBe(
      "An admin paused your ID and certificate uploads.",
    );
  });
});

describe("uploadStatusApi.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads GET /api/v1/files/upload-status", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify(
          status({ blocksVideos: true, note: "Check the video." }),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(uploadStatusApi.get()).resolves.toMatchObject({
      blocksVideos: true,
      note: "Check the video.",
    });
    const [url, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(init?.method).toBe("GET");
    expect(new URL(String(url)).pathname).toBe("/api/v1/files/upload-status");
  });
});
